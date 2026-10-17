import { NextResponse } from "next/server";
import { albumPulse } from "@/lib/pulse";
import { rateLimit } from "@/lib/rate-limit";

// Guest pages poll this every few seconds: who's uploading, and is there a new photo.
// Cloudflare caches it, so this per-IP cap (a whole venue may share one) is only against floods.
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!(await rateLimit("pulse", 20_000, 60_000))) return NextResponse.json({ error: "Slow down." }, { status: 429 });
  const p = await albumPulse((await params).slug);
  if (!p) return NextResponse.json({ error: "Not found." }, { status: 404 });
  // Same answer for every phone in the album: Cloudflare may serve it for 2 s,
  // so hundreds of open phones cost the server a handful of requests.
  return NextResponse.json(p, { headers: { "cache-control": "public, max-age=0, s-maxage=2", "cdn-cache-control": "max-age=2" } });
}
