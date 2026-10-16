import { NextResponse } from "next/server";
import sharp from "sharp";
import { q } from "@/lib/db";
import { getEventBySlug } from "@/lib/events";
import { currentGuest } from "@/lib/guests";
import { rateLimit } from "@/lib/rate-limit";
import { publicUrl, putObject } from "@/lib/storage";

// The joined guest's selfie (avatar). The phone already sends a small square;
// the server re-encodes it (drops metadata, proves it's an image) to 256 px WebP.

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const e = await getEventBySlug((await params).slug);
  if (!e || !e.paid_at || e.purged_at) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const guest = await currentGuest(e.id);
  if (!guest) return NextResponse.json({ error: "Please join the event first.", code: "join" }, { status: 401 });
  if (guest.is_blocked) return NextResponse.json({ error: "Not allowed from this phone." }, { status: 403 });
  if (!(await rateLimit("avatar", 10, 10 * 60_000, guest.id))) return NextResponse.json({ error: "Try again in a few minutes." }, { status: 429 });
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > 3_000_000) return NextResponse.json({ error: "That photo is too big." }, { status: 413 });
  const body = Buffer.from(await req.arrayBuffer());
  if (body.length > 3_000_000 || body.length < 100) return NextResponse.json({ error: "That photo can't be used." }, { status: 400 });
  let out: Buffer;
  try {
    out = await sharp(body, { limitInputPixels: 30_000_000 }).rotate().resize(256, 256, { fit: "cover", position: "attention" }).webp({ quality: 82 }).toBuffer();
  } catch {
    return NextResponse.json({ error: "That photo can't be used." }, { status: 400 });
  }
  // A new key each time, so phones never show a cached old selfie.
  const key = `ev/${e.id}/avatars/${guest.id}-${Date.now().toString(36)}.webp`;
  await putObject(key, out, "image/webp", "public, max-age=31536000, immutable");
  await q("update guests set avatar_key = $2 where id = $1", [guest.id, key]);
  return NextResponse.json({ avatar: publicUrl(key) });
}
