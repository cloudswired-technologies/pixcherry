import { NextResponse } from "next/server";
import { listPeople } from "@/lib/engage";
import { getEventBySlug } from "@/lib/events";
import { rateLimit } from "@/lib/rate-limit";

// "Folders": one entry per guest who shared at least one photo.

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const e = await getEventBySlug((await params).slug);
  if (!e || !e.paid_at || e.purged_at) return NextResponse.json({ error: "Event not found." }, { status: 404 });
  if (!(await rateLimit("people", 600, 60_000))) return NextResponse.json({ error: "Slow down." }, { status: 429 });
  return NextResponse.json({ people: await listPeople(e.id) }, { headers: { "cache-control": "no-store" } });
}
