import { NextResponse } from "next/server";
import { toggleVote } from "@/lib/engage";
import { getEventBySlug } from "@/lib/events";
import { currentGuest } from "@/lib/guests";
import { rateLimit } from "@/lib/rate-limit";

// Heart / un-heart a photo. One heart per guest per photo.

export async function POST(_req: Request, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const e = await getEventBySlug(slug);
  if (!e || !e.paid_at || e.purged_at || !e.cfg.features.voting) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const guest = await currentGuest(e.id);
  if (!guest) return NextResponse.json({ error: "Join the event to heart photos.", code: "join" }, { status: 401 });
  if (!(await rateLimit("vote", 120, 60_000, guest.id))) return NextResponse.json({ error: "Slow down." }, { status: 429 });
  const r = await toggleVote(e.id, guest.id, id);
  if (!r) return NextResponse.json({ error: "Photo not found." }, { status: 404 });
  return NextResponse.json(r);
}
