import "server-only";
import { one, q, tx } from "@/lib/db";

// Photo comments (Instagram style). Joined guests write; the writer or the
// organiser removes. photos.comment_count keeps the gallery badge cheap.

const UUID = /^[0-9a-f-]{36}$/;

export type Comment = { id: string; name: string | null; body: string; at: string; mine: boolean; guest: string | null };

type Row = { id: string; name: string | null; body: string; created_at: Date; guest_id: string | null };

const toComment = (r: Row, viewer: string | null): Comment => ({
  id: r.id,
  name: r.name,
  body: r.body,
  at: new Date(r.created_at).toISOString(),
  mine: !!viewer && r.guest_id === viewer,
  guest: r.guest_id,
});

export function cleanComment(raw: unknown) {
  return String(raw ?? "").replace(/[\u0000-\u0009\u000b-\u001f<>]/g, "").replace(/\n{2,}/g, "\n").trim().slice(0, 300);
}

export async function listComments(eventId: string, photoId: string, viewer: string | null) {
  if (!UUID.test(photoId)) return [];
  const rows = await q<Row>(
    "select id, name, body, created_at, guest_id from photo_comments where event_id = $1 and photo_id = $2 order by created_at limit 300",
    [eventId, photoId],
  );
  return rows.map((r) => toComment(r, viewer));
}

export async function addComment(eventId: string, photoId: string, guest: { id: string; name: string | null }, body: string) {
  if (!UUID.test(photoId)) return null;
  return tx(async (c) => {
    const p = await one("select 1 from photos where id = $1 and event_id = $2 and status = 'ready' for update", [photoId, eventId], c);
    if (!p) return null;
    const r = await one<Row>(
      "insert into photo_comments (event_id, photo_id, guest_id, name, body) values ($1, $2, $3, $4, $5) returning id, name, body, created_at, guest_id",
      [eventId, photoId, guest.id, guest.name, body],
      c,
    );
    const n = await one<{ comment_count: number }>("update photos set comment_count = comment_count + 1 where id = $1 returning comment_count", [photoId], c);
    return { comment: toComment(r!, guest.id), count: n!.comment_count };
  });
}

/** Removes a comment. `guestId` limits it to the writer's own; null = organiser. */
export async function deleteComment(eventId: string, commentId: string, guestId: string | null) {
  if (!UUID.test(commentId)) return null;
  return tx(async (c) => {
    const r = await one<{ photo_id: string }>(
      `delete from photo_comments where id = $1 and event_id = $2 ${guestId ? "and guest_id = $3" : ""} returning photo_id`,
      guestId ? [commentId, eventId, guestId] : [commentId, eventId],
      c,
    );
    if (!r) return null;
    const n = await one<{ comment_count: number }>("update photos set comment_count = greatest(0, comment_count - 1) where id = $1 returning comment_count", [r.photo_id], c);
    return { photo: r.photo_id, count: n?.comment_count ?? 0 };
  });
}

export type RecentComment = Comment & { photo: string };

/** Newest comments across the event, for the organiser's moderation list. */
export async function recentComments(eventId: string, limit = 100): Promise<RecentComment[]> {
  const rows = await q<Row & { photo_id: string }>(
    "select id, name, body, created_at, guest_id, photo_id from photo_comments where event_id = $1 order by created_at desc limit $2",
    [eventId, Math.min(limit, 500)],
  );
  return rows.map((r) => ({ ...toComment(r, null), photo: r.photo_id }));
}
