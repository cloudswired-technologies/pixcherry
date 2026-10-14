import { NextResponse } from "next/server";
import { getEventBySlug } from "@/lib/events";
import { currentGuest } from "@/lib/guests";
import { cancelUpload, markUploaded } from "@/lib/photos";

// Step 3 of an upload: the browser finished (or gave up on) the PUT to storage.

export async function POST(req: Request, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "Bad id" }, { status: 400 });
  const e = await getEventBySlug(slug);
  if (!e) return NextResponse.json({ error: "Event not found." }, { status: 404 });
  const guest = await currentGuest(e.id);
  if (!guest) return NextResponse.json({ error: "Please join the event first." }, { status: 401 });
  const action = new URL(req.url).searchParams.get("action");
  if (action === "cancel") {
    await cancelUpload(e.id, guest.id, id);
    return NextResponse.json({ ok: true });
  }
  const ok = await markUploaded(e.id, guest.id, id);
  return NextResponse.json({ ok }, { status: ok ? 200 : 409 });
}
