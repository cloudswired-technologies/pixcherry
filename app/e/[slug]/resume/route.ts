import { NextResponse } from "next/server";
import { getEventBySlug } from "@/lib/events";
import { GUEST_HOST, GUEST_URL } from "@/lib/env";
import { resumeGuest } from "@/lib/guests";
import { rateLimit } from "@/lib/rate-limit";

// Start link of the home-screen app: signs this browser in as the guest who
// installed it (installed apps don't share the browser's cookies), then opens the album.

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const back = GUEST_HOST ? `${GUEST_URL}/${slug}` : `/e/${slug}`;
  const e = await getEventBySlug(slug);
  const key = new URL(req.url).searchParams.get("k");
  if (e && key && key.length < 600 && (await rateLimit("resume", 600, 60_000))) await resumeGuest(e.id, key);
  return new NextResponse(null, { status: 303, headers: { location: back, "cache-control": "no-store" } });
}
