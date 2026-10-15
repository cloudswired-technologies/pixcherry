import { NextResponse } from "next/server";
import { getEventBySlug } from "@/lib/events";
import { currentGuest } from "@/lib/guests";
import { setCaption } from "@/lib/photos";
import { rateLimit } from "@/lib/rate-limit";

// The guest who shared a photo adds, edits or clears its caption.
export async function POST(req: Request, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const e = await getEventBySlug(slug);
  if (!e || !e.paid_at || e.purged_at) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const guest = await currentGuest(e.id);
  if (!guest) return NextResponse.json({ error: "Please join the event first.", code: "join" }, { status: 401 });
  if (guest.is_blocked) return NextResponse.json({ error: "Posting is turned off for this phone." }, { status: 403 });
  if (!(await rateLimit("caption", 30, 5 * 60_000, guest.id))) return NextResponse.json({ error: "Easy there! Try again in a few minutes." }, { status: 429 });
  const body = (await req.json().catch(() => null)) as { caption?: unknown } | null;
  const r = await setCaption(e.id, guest.id, id, body?.caption);
  if (!r) return NextResponse.json({ error: "You can only caption your own photos." }, { status: 403 });
  return NextResponse.json(r);
}
