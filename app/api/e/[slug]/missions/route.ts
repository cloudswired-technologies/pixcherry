import { NextResponse } from "next/server";
import { missionBoard } from "@/lib/engage";
import { getEventBySlug } from "@/lib/events";
import { rateLimit } from "@/lib/rate-limit";

// Missions tab: who completed each mission (fastest first) and the "mission masters".

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const e = await getEventBySlug((await params).slug);
  if (!e || !e.paid_at || e.purged_at || !e.cfg.features.missions) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!(await rateLimit("missions", 600, 60_000))) return NextResponse.json({ error: "Slow down." }, { status: 429 });
  return NextResponse.json(await missionBoard(e.id), { headers: { "cache-control": "no-store" } });
}
