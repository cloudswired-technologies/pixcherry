import { NextResponse } from "next/server";
import { albumPulse } from "@/lib/pulse";
import { rateLimit } from "@/lib/rate-limit";

// Guest pages poll this every few seconds: who's uploading, and is there a new photo.
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!(await rateLimit("pulse", 3000, 60_000))) return NextResponse.json({ error: "Slow down." }, { status: 429 });
  const p = await albumPulse((await params).slug);
  if (!p) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json(p, { headers: { "cache-control": "no-store" } });
}
