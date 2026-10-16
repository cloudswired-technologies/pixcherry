import { photoWithCaption } from "@/lib/caption-image";
import { one } from "@/lib/db";
import { getEventBySlug } from "@/lib/events";
import { cookieGuestId } from "@/lib/guests";
import { guestLimit } from "@/lib/rate-limit";
import { getObjectStream, photoKeys } from "@/lib/storage";

// Single-photo download with a proper filename (a cross-origin <a download> is
// ignored by browsers, so this goes through the app). A captioned photo comes
// with its caption written underneath.

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response("Not found", { status: 404 });
  const e = await getEventBySlug(slug);
  if (!e || !e.paid_at || e.purged_at) return new Response("Not found", { status: 404 });
  if (!(await guestLimit("photo-dl", 300, 10 * 60_000, await cookieGuestId(e.id)))) return new Response("Please slow down.", { status: 429 });
  const p = await one<{ caption: string | null; name: string | null }>(
    "select p.caption, g.name from photos p left join guests g on g.id = p.guest_id where p.id = $1 and p.event_id = $2 and p.status = 'ready'",
    [id, e.id],
  );
  if (!p) return new Response("Not found", { status: 404 });
  const stream = await getObjectStream(photoKeys(e.id, id).full);
  if (!stream) return new Response("Not found", { status: 404 });
  const headers = {
    "content-type": "image/jpeg",
    "content-disposition": `attachment; filename="pixcherry-${id.slice(0, 8)}.jpg"`,
    "cache-control": "private, max-age=3600",
  };
  if (p.caption) {
    const bytes = Buffer.from(await new Response(stream).arrayBuffer());
    try {
      return new Response(new Uint8Array(await photoWithCaption(bytes, p.caption, p.name, e.name)), { headers });
    } catch (err) {
      console.error("caption render failed", err);
      return new Response(new Uint8Array(bytes), { headers });
    }
  }
  return new Response(stream, {
    headers: {
      "content-type": "image/jpeg",
      "content-disposition": `attachment; filename="pixcherry-${id.slice(0, 8)}.jpg"`,
      "cache-control": "private, max-age=3600",
    },
  });
}
