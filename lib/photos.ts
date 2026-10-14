import "server-only";
import { one, q, tx } from "@/lib/db";
import type { EventWithConfig } from "@/lib/events";
import { deletePrefix, deleteObject, photoKeys, presignPut, publicUrl } from "@/lib/storage";

export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_FILES_PER_REQUEST = 10;

export type Reservation = { id: string; url: string; type: string; size: number };

/**
 * Reserves upload slots for a guest and returns presigned PUT URLs. Grants as
 * many files as the guest and event quotas allow (possibly fewer than asked).
 */
export async function reserveUploads(e: EventWithConfig, guestId: string, files: { type: string; size: number }[]) {
  const maxBytes = e.cfg.limits.max_file_mb * 1024 * 1024;
  for (const f of files) {
    if (!(ACCEPTED_TYPES as readonly string[]).includes(f.type)) return { error: "Only JPEG, PNG or WebP photos can be uploaded." } as const;
    if (!Number.isInteger(f.size) || f.size < 100 || f.size > maxBytes) return { error: `Each photo must be under ${e.cfg.limits.max_file_mb} MB.` } as const;
  }
  const granted = await tx(async (c) => {
    const ev = await one<{ slot_count: number }>("select slot_count from events where id = $1 for update", [e.id], c);
    const g = await one<{ upload_count: number; is_blocked: boolean }>("select upload_count, is_blocked from guests where id = $1 for update", [guestId], c);
    if (!g || g.is_blocked) return { error: "Uploads are turned off for this phone." } as const;
    const guestLeft = e.cfg.limits.photos_per_guest - g.upload_count;
    const eventLeft = e.cfg.limits.max_photos - (ev?.slot_count ?? 0);
    const n = Math.max(0, Math.min(files.length, guestLeft, eventLeft));
    if (n === 0) {
      return {
        error: guestLeft <= 0
          ? `You've reached the limit of ${e.cfg.limits.photos_per_guest} photos. Thank you for sharing!`
          : "This event's album is full.",
      } as const;
    }
    const rows: { id: string; type: string; size: number }[] = [];
    for (const f of files.slice(0, n)) {
      const r = await one<{ id: string }>(
        "insert into photos (event_id, guest_id, content_type, declared_bytes) values ($1, $2, $3, $4) returning id",
        [e.id, guestId, f.type, f.size],
        c,
      );
      rows.push({ id: r!.id, type: f.type, size: f.size });
    }
    await q("update guests set upload_count = upload_count + $2, last_seen_at = now() where id = $1", [guestId, n], c);
    await q("update events set slot_count = slot_count + $2 where id = $1", [e.id, n], c);
    return { rows, remaining: guestLeft - n };
  });
  if ("error" in granted) return granted;
  const uploads: Reservation[] = await Promise.all(
    granted.rows.map(async (r) => ({ ...r, url: await presignPut(photoKeys(e.id, r.id).incoming, r.type, r.size) })),
  );
  return { uploads, remaining: granted.remaining, refused: files.length - uploads.length };
}

export async function markUploaded(eventId: string, guestId: string, photoId: string) {
  const r = await q(
    "update photos set status = 'uploaded', uploaded_at = now() where id = $1 and event_id = $2 and guest_id = $3 and status = 'pending' returning id",
    [photoId, eventId, guestId],
  );
  return r.length === 1;
}

/** Guest gave up on a file (e.g. PUT failed for good): release the slot. */
export async function cancelUpload(eventId: string, guestId: string, photoId: string) {
  const r = await q(
    "update photos set status = 'failed', error = 'cancelled' where id = $1 and event_id = $2 and guest_id = $3 and status = 'pending' returning id",
    [photoId, eventId, guestId],
  );
  if (r.length) {
    await q("update guests set upload_count = greatest(0, upload_count - 1) where id = $1", [guestId]);
    await q("update events set slot_count = greatest(0, slot_count - 1) where id = $1", [eventId]);
    await deleteObject(photoKeys(eventId, photoId).incoming).catch(() => {});
  }
}

export type GalleryPhoto = {
  id: string;
  sm: string;
  md: string;
  full: string;
  w: number;
  h: number;
  by: string | null;
  at: string;
  status: "ready" | "review";
  mine: boolean;
};

type Row = { id: string; width: number; height: number; name: string | null; ready_at: Date; status: "ready" | "review"; guest_id: string | null };

function toGallery(eventId: string, r: Row, guestId: string | null): GalleryPhoto {
  const k = photoKeys(eventId, r.id);
  return {
    id: r.id,
    sm: publicUrl(k.sm),
    md: publicUrl(k.md),
    full: publicUrl(k.full),
    w: r.width,
    h: r.height,
    by: r.name,
    at: new Date(r.ready_at).toISOString(),
    status: r.status,
    mine: !!guestId && r.guest_id === guestId,
  };
}

/**
 * Gallery page. order=new pages backwards in time, old forwards. `after` = cursor
 * "<iso>|<id>" of the last item seen. `includeReview`: organiser view.
 */
export async function listPhotos(
  eventId: string,
  opts: { order: "new" | "old"; cursor?: string | null; limit?: number; includeReview?: boolean; guestId?: string | null; since?: string | null },
) {
  const limit = Math.min(opts.limit ?? 60, 200);
  const params: unknown[] = [eventId];
  let where = `p.event_id = $1 and (p.status = 'ready'${opts.includeReview ? " or p.status = 'review'" : ""}${
    opts.guestId && !opts.includeReview ? ` or (p.status = 'review' and p.guest_id = $${params.push(opts.guestId)})` : ""
  })`;
  const cur = opts.cursor?.split("|");
  if (cur && cur.length === 2 && !Number.isNaN(Date.parse(cur[0])) && /^[0-9a-f-]{36}$/.test(cur[1])) {
    const op = opts.order === "new" ? "<" : ">";
    where += ` and (p.ready_at, p.id) ${op} ($${params.push(cur[0])}::timestamptz, $${params.push(cur[1])}::uuid)`;
  }
  if (opts.since && !Number.isNaN(Date.parse(opts.since))) where += ` and p.ready_at > $${params.push(opts.since)}::timestamptz`;
  const dir = opts.order === "new" ? "desc" : "asc";
  const rows = await q<Row>(
    `select p.id, p.width, p.height, g.name, p.ready_at, p.status, p.guest_id
     from photos p left join guests g on g.id = p.guest_id
     where ${where} order by p.ready_at ${dir}, p.id ${dir} limit ${limit + 1}`,
    params,
  );
  const more = rows.length > limit;
  const page = rows.slice(0, limit);
  const last = page.at(-1);
  return {
    photos: page.map((r) => toGallery(eventId, r, opts.guestId ?? null)),
    next: more && last ? `${new Date(last.ready_at).toISOString()}|${last.id}` : null,
  };
}

/** Organiser removes a photo: storage goes now, counters follow. */
export async function deletePhoto(eventId: string, photoId: string) {
  const r = await one<{ bytes: string | null; was: string }>(
    `update photos p set status = 'deleted' from (select id, status as was from photos where id = $1 and event_id = $2 for update) old
     where p.id = old.id and old.was in ('ready','review') returning p.bytes, old.was`,
    [photoId, eventId],
  );
  if (!r) return false;
  await q("update events set photo_count = greatest(0, photo_count - 1), slot_count = greatest(0, slot_count - 1), bytes_used = greatest(0, bytes_used - $2) where id = $1", [eventId, Number(r.bytes ?? 0)]);
  await deletePrefix(photoKeys(eventId, photoId).prefix);
  return true;
}

export async function approvePhotos(eventId: string, ids: string[]) {
  if (!ids.length) return 0;
  const r = await q("update photos set status = 'ready' where event_id = $1 and id = any($2::uuid[]) and status = 'review' returning id", [eventId, ids]);
  return r.length;
}

export async function pendingReviewCount(eventId: string) {
  return (await one<{ n: number }>("select count(*)::int as n from photos where event_id = $1 and status = 'review'", [eventId]))?.n ?? 0;
}
