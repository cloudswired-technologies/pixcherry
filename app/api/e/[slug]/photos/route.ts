import { NextResponse } from "next/server";
import { getEventBySlug } from "@/lib/events";
import { currentGuest } from "@/lib/guests";
import { listPhotos } from "@/lib/photos";
import { rateLimit } from "@/lib/rate-limit";

// Gallery feed for the guest page: newest / oldest / top, one uploader's folder,
// one mission, and "since" polling for new photos.

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const e = await getEventBySlug((await params).slug);
  if (!e || !e.paid_at || e.purged_at) return NextResponse.json({ error: "Event not found." }, { status: 404 });
  if (!(await rateLimit("gallery", 240, 60_000))) return NextResponse.json({ error: "Slow down." }, { status: 429 });
  const u = new URL(req.url);
  const guest = await currentGuest(e.id);
  const o = u.searchParams.get("order");
  const order = o === "old" ? "old" : o === "top" && e.cfg.features.voting ? "top" : "new";
  const r = await listPhotos(e.id, {
    order,
    cursor: u.searchParams.get("cursor"),
    since: u.searchParams.get("since"),
    viewer: guest?.id ?? null,
    byGuest: u.searchParams.get("guest"),
    mission: e.cfg.features.missions ? u.searchParams.get("mission") : null,
    limit: Number(u.searchParams.get("limit")) || 60,
  });
  return NextResponse.json({ ...r, count: e.photo_count }, { headers: { "cache-control": "no-store" } });
}
