import { albumResponse } from "@/lib/album";
import { currentUser } from "@/lib/auth";
import { getEventBySlug } from "@/lib/events";
import { currentGuest } from "@/lib/guests";
import { rateLimit } from "@/lib/rate-limit";

// Whole-album ZIP. Organiser (or admin) always; guests only when the package allows it.

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const e = await getEventBySlug((await params).slug);
  if (!e || !e.paid_at || e.purged_at) return new Response("Not found", { status: 404 });
  const user = await currentUser();
  const isOwner = !!user && (user.id === e.owner_id || user.is_admin);
  if (!isOwner) {
    if (!e.cfg.features.guest_album_download || !(await currentGuest(e.id))) return new Response("Only the organiser can download the full album.", { status: 403 });
    if (!(await rateLimit("album-guest", 10, 3600_000))) return new Response("Please try again later.", { status: 429 });
  }
  return albumResponse(e);
}
