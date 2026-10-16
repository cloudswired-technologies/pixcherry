import { NextResponse } from "next/server";
import { addWish, cleanMessage, listWishes } from "@/lib/engage";
import { getEventBySlug } from "@/lib/events";
import { cookieGuestId, currentGuest } from "@/lib/guests";
import { guestLimit, rateLimit } from "@/lib/rate-limit";

// Wishes wall: read (anyone with the link) and write (joined guests).

async function load(slug: string) {
  const e = await getEventBySlug(slug);
  if (!e || !e.paid_at || e.purged_at || !e.cfg.features.wishes) return null;
  return e;
}

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const e = await load((await params).slug);
  if (!e) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!(await guestLimit("wishes-read", 60, 60_000, await cookieGuestId(e.id)))) return NextResponse.json({ error: "Slow down." }, { status: 429 });
  const since = new URL(req.url).searchParams.get("since");
  return NextResponse.json({ wishes: await listWishes(e.id, { since }) }, { headers: { "cache-control": "no-store" } });
}

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const e = await load((await params).slug);
  if (!e) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const guest = await currentGuest(e.id);
  if (!guest) return NextResponse.json({ error: "Please join the event first.", code: "join" }, { status: 401 });
  if (guest.is_blocked) return NextResponse.json({ error: "Posting is turned off for this phone." }, { status: 403 });
  if (!(await rateLimit("wish", 5, 10 * 60_000, guest.id))) return NextResponse.json({ error: "That's a lot of wishes! Try again in a few minutes." }, { status: 429 });
  const body = (await req.json().catch(() => null)) as { message?: unknown; photo?: unknown } | null;
  const message = cleanMessage(body?.message);
  if (message.length < 2) return NextResponse.json({ error: "Write a few words first." }, { status: 400 });
  const wish = await addWish(e.id, { id: guest.id, name: guest.name }, message, typeof body?.photo === "string" ? body.photo : null);
  return NextResponse.json({ wish });
}
