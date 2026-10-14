import { one } from "@/lib/db";
import { getEventBySlug } from "@/lib/events";
import { rateLimit } from "@/lib/rate-limit";
import { getObjectStream, photoKeys } from "@/lib/storage";

// Single-photo download with a proper filename (a cross-origin <a download> is
// ignored by browsers, so this goes through the app).

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response("Not found", { status: 404 });
  const e = await getEventBySlug(slug);
  if (!e || !e.paid_at || e.purged_at) return new Response("Not found", { status: 404 });
  if (!(await rateLimit("photo-dl", 300, 10 * 60_000))) return new Response("Please slow down.", { status: 429 });
  const p = await one("select id from photos where id = $1 and event_id = $2 and status = 'ready'", [id, e.id]);
  if (!p) return new Response("Not found", { status: 404 });
  const stream = await getObjectStream(photoKeys(e.id, id).full);
  if (!stream) return new Response("Not found", { status: 404 });
  return new Response(stream, {
    headers: {
      "content-type": "image/jpeg",
      "content-disposition": `attachment; filename="eventsnap-${id.slice(0, 8)}.jpg"`,
      "cache-control": "private, max-age=3600",
    },
  });
}
