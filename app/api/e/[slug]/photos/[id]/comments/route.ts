import { NextResponse } from "next/server";
import { addComment, cleanComment, deleteComment, listComments } from "@/lib/comments";
import { getEventBySlug } from "@/lib/events";
import { currentGuest } from "@/lib/guests";
import { rateLimit } from "@/lib/rate-limit";

// Comments under one photo: read (anyone with the link), write (joined guests),
// delete (the writer).

type Ctx = { params: Promise<{ slug: string; id: string }> };

async function load(slug: string) {
  const e = await getEventBySlug(slug);
  if (!e || !e.paid_at || e.purged_at || !e.cfg.features.comments) return null;
  return e;
}

export async function GET(_req: Request, { params }: Ctx) {
  const { slug, id } = await params;
  const e = await load(slug);
  if (!e) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!(await rateLimit("comments-read", 600, 60_000))) return NextResponse.json({ error: "Slow down." }, { status: 429 });
  const guest = await currentGuest(e.id);
  return NextResponse.json({ comments: await listComments(e.id, id, guest?.id ?? null) }, { headers: { "cache-control": "no-store" } });
}

export async function POST(req: Request, { params }: Ctx) {
  const { slug, id } = await params;
  const e = await load(slug);
  if (!e) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const guest = await currentGuest(e.id);
  if (!guest) return NextResponse.json({ error: "Please join the event first.", code: "join" }, { status: 401 });
  if (guest.is_blocked) return NextResponse.json({ error: "Posting is turned off for this phone." }, { status: 403 });
  if (!(await rateLimit("comment", 20, 5 * 60_000, guest.id))) return NextResponse.json({ error: "Easy there! Try again in a few minutes." }, { status: 429 });
  const body = cleanComment(((await req.json().catch(() => null)) as { body?: unknown } | null)?.body);
  if (!body) return NextResponse.json({ error: "Write something first." }, { status: 400 });
  const r = await addComment(e.id, id, { id: guest.id, name: guest.name }, body);
  if (!r) return NextResponse.json({ error: "This photo is no longer here." }, { status: 404 });
  return NextResponse.json(r);
}

export async function DELETE(req: Request, { params }: Ctx) {
  const { slug } = await params;
  const e = await load(slug);
  if (!e) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const guest = await currentGuest(e.id);
  if (!guest) return NextResponse.json({ error: "Please join the event first.", code: "join" }, { status: 401 });
  const r = await deleteComment(e.id, new URL(req.url).searchParams.get("c") ?? "", guest.id);
  if (!r) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json(r);
}
