import { NextResponse } from "next/server";
import { getEventBySlug } from "@/lib/events";
import { currentGuest } from "@/lib/guests";
import { reportPhoto } from "@/lib/photos";
import { rateLimit } from "@/lib/rate-limit";

// A guest reports someone else's photo. It disappears for them at once; after
// enough reports it is hidden for everyone until the host approves or deletes it.

export async function POST(_req: Request, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const e = await getEventBySlug(slug);
  if (!e || !e.paid_at || e.purged_at) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const guest = await currentGuest(e.id);
  if (!guest) return NextResponse.json({ error: "Join the event to report photos.", code: "join" }, { status: 401 });
  if (!(await rateLimit("report", 20, 3600_000, guest.id))) return NextResponse.json({ error: "Too many reports. Try again later." }, { status: 429 });
  const r = await reportPhoto(e.id, guest.id, id);
  if (!r) return NextResponse.json({ error: "Photo not found." }, { status: 404 });
  return NextResponse.json(r);
}
