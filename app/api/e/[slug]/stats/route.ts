import { NextResponse } from "next/server";
import { eventStats, listMissions, missionsDoneBy } from "@/lib/engage";
import { getEventBySlug } from "@/lib/events";
import { currentGuest } from "@/lib/guests";
import { rateLimit } from "@/lib/rate-limit";

// Live numbers for the guest page and slideshow: counts, leaderboards, missions.

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const e = await getEventBySlug((await params).slug);
  if (!e || !e.paid_at || e.purged_at) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!(await rateLimit("stats", 120, 60_000))) return NextResponse.json({ error: "Slow down." }, { status: 429 });
  const guest = await currentGuest(e.id);
  const f = e.cfg.features;
  const [stats, missions, mine] = await Promise.all([
    eventStats(e.id),
    f.missions ? listMissions(e.id) : Promise.resolve([]),
    f.missions && guest ? missionsDoneBy(guest.id) : Promise.resolve([]),
  ]);
  return NextResponse.json(
    {
      ...stats,
      topSnappers: f.voting ? stats.topSnappers : [],
      topPhotos: f.voting ? stats.topPhotos : [],
      missions,
      missionsDone: mine,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
