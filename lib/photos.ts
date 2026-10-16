import "server-only";
import { one, q, tx } from "@/lib/db";
import type { EventWithConfig } from "@/lib/events";
import { deletePrefix, deleteObject, photoKeys, presignPut, publicUrl } from "@/lib/storage";
import { cleanTags } from "@/lib/tags";

export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_FILES_PER_REQUEST = 10;

export type Reservation = { id: string; url: string; type: string; size: number };

const UUID = /^[0-9a-f-]{36}$/;

/**
 * Reserves upload slots for a guest and returns presigned PUT URLs. Grants as
 * many files as the guest and event quotas allow (possibly fewer than asked).
 * A file may name a snap mission; unknown missions are dropped silently.
 */
export async function reserveUploads(e: EventWithConfig, guestId: string, files: { type: string; size: number; mission?: string | null; tags?: unknown; caption?: unknown }[]) {
  const maxBytes = e.cfg.limits.max_file_mb * 1024 * 1024;
  for (const f of files) {
    if (!(ACCEPTED_TYPES as readonly string[]).includes(f.type)) return { error: "Only JPEG, PNG or WebP photos can be uploaded." } as const;
    if (!Number.isInteger(f.size) || f.size < 100 || f.size > maxBytes) return { error: `Each photo must be under ${e.cfg.limits.max_file_mb} MB.` } as const;
  }
  const asked = [...new Set(files.map((f) => f.mission).filter((m): m is string => !!m && UUID.test(m)))];
  const valid = new Set(
    e.cfg.features.missions && asked.length
      ? (await q<{ id: string }>("select id from event_missions where event_id = $1 and id = any($2::uuid[])", [e.id, asked])).map((r) => r.id)
      : [],
  );
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
          ? `That's your whole roll — ${e.cfg.limits.photos_per_guest} shots! Thank you for sharing.`
          : "This event's album is full.",
      } as const;
    }
    const rows: { id: string; type: string; size: number }[] = [];
    for (const f of files.slice(0, n)) {
      const r = await one<{ id: string }>(
        "insert into photos (event_id, guest_id, content_type, declared_bytes, mission_id, tags, caption) values ($1, $2, $3, $4, $5, $6, $7) returning id",
        [e.id, guestId, f.type, f.size, f.mission && valid.has(f.mission) ? f.mission : null, e.cfg.features.tags ? cleanTags(f.tags) : [], cleanCaption(f.caption)],
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
  guest: string | null; // uploader's folder id
  at: string;
  status: "ready" | "review";
  mine: boolean;
  votes: number;
  voted: boolean;
  mission: string | null;
  tags: string[];
  caption: string | null;
  /** Uploader's selfie, if they added one. */
  avatar: string | null;
};

type Row = {
  id: string;
  width: number;
  height: number;
  name: string | null;
  ready_at: Date;
  status: "ready" | "review";
  guest_id: string | null;
  vote_count: number;
  voted: boolean;
  mission_id: string | null;
  tags: string[];
  caption: string | null;
  avatar_key: string | null;
};

function toGallery(eventId: string, r: Row, viewer: string | null): GalleryPhoto {
  const k = photoKeys(eventId, r.id);
  return {
    id: r.id,
    sm: publicUrl(k.sm),
    md: publicUrl(k.md),
    full: publicUrl(k.full),
    w: r.width,
    h: r.height,
    by: r.name,
    guest: r.guest_id,
    at: new Date(r.ready_at).toISOString(),
    status: r.status,
    mine: !!viewer && r.guest_id === viewer,
    votes: r.vote_count,
    voted: r.voted,
    mission: r.mission_id,
    tags: r.tags ?? [],
    caption: r.caption ?? null,
    avatar: r.avatar_key ? publicUrl(r.avatar_key) : null,
  };
}

export type ListOptions = {
  order: "new" | "old" | "top";
  cursor?: string | null;
  limit?: number;
  includeReview?: boolean; // organiser view
  viewer?: string | null; // guest looking at the gallery (sees own photos waiting for approval, own hearts)
  since?: string | null;
  byGuest?: string | null; // folder: one uploader
  mission?: string | null;
  tag?: string | null;
};

/**
 * Gallery page. new/old page by "<iso>|<id>" cursor; top pages by offset ("o:<n>").
 */
export async function listPhotos(eventId: string, opts: ListOptions) {
  const limit = Math.min(opts.limit ?? 60, 200);
  const params: unknown[] = [eventId];
  const viewer = opts.viewer && UUID.test(opts.viewer) ? opts.viewer : null;
  const viewerParam = viewer ? `$${params.push(viewer)}::uuid` : "null::uuid";
  let where = `p.event_id = $1 and (p.status = 'ready'${opts.includeReview ? " or p.status = 'review'" : ""}${
    viewer && !opts.includeReview ? ` or (p.status = 'review' and p.guest_id = ${viewerParam})` : ""
  })`;
  // Photos this guest reported disappear for them straight away.
  if (viewer) where += ` and not exists (select 1 from photo_reports r where r.photo_id = p.id and r.guest_id = ${viewerParam})`;
  if (opts.byGuest && UUID.test(opts.byGuest)) where += ` and p.guest_id = $${params.push(opts.byGuest)}::uuid`;
  if (opts.mission && UUID.test(opts.mission)) where += ` and p.mission_id = $${params.push(opts.mission)}::uuid`;
  if (opts.tag && /^[a-z0-9_]{2,24}$/.test(opts.tag)) where += ` and $${params.push(opts.tag)} = any(p.tags)`;
  let order: string;
  let offset = 0;
  if (opts.order === "top") {
    order = "p.vote_count desc, p.ready_at desc, p.id desc";
    const m = opts.cursor?.match(/^o:(\d{1,6})$/);
    offset = m ? Number(m[1]) : 0;
  } else {
    const cur = opts.cursor?.split("|");
    if (cur && cur.length === 2 && !Number.isNaN(Date.parse(cur[0])) && UUID.test(cur[1])) {
      const op = opts.order === "new" ? "<" : ">";
      where += ` and (p.ready_at, p.id) ${op} ($${params.push(cur[0])}::timestamptz, $${params.push(cur[1])}::uuid)`;
    }
    const dir = opts.order === "new" ? "desc" : "asc";
    order = `p.ready_at ${dir}, p.id ${dir}`;
  }
  if (opts.since && !Number.isNaN(Date.parse(opts.since))) where += ` and p.ready_at > $${params.push(opts.since)}::timestamptz`;
  const rows = await q<Row>(
    `select p.id, p.width, p.height, g.name, p.ready_at, p.status, p.guest_id, p.vote_count, p.mission_id, p.tags, p.caption, g.avatar_key,
       exists (select 1 from photo_votes v where v.photo_id = p.id and v.guest_id = ${viewerParam}) as voted
     from photos p left join guests g on g.id = p.guest_id
     where ${where} order by ${order} limit ${limit + 1} offset ${offset}`,
    params,
  );
  const more = rows.length > limit;
  const page = rows.slice(0, limit);
  const last = page.at(-1);
  const next = !more || !last ? null : opts.order === "top" ? `o:${offset + limit}` : `${new Date(last.ready_at).toISOString()}|${last.id}`;
  return { photos: page.map((r) => toGallery(eventId, r, viewer)), next };
}

/** One line, no markup, at most 140 characters; empty = no caption. */
export function cleanCaption(raw: unknown) {
  const s = String(raw ?? "").replace(/[\x00-\x1f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, 140);
  return s || null;
}

/** The guest who shared a photo sets or clears its caption. */
export async function setCaption(eventId: string, guestId: string, photoId: string, caption: unknown) {
  if (!UUID.test(photoId)) return null;
  const r = await one<{ caption: string | null }>(
    "update photos set caption = $4 where id = $1 and event_id = $2 and guest_id = $3 and status in ('ready','review') returning caption",
    [photoId, eventId, guestId, cleanCaption(caption)],
  );
  return r ? { caption: r.caption } : null;
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
  const r = await q(
    "update photos set status = 'ready', flag = null, approved_at = now() where event_id = $1 and id = any($2::uuid[]) and (status = 'review' or flag is not null) returning id",
    [eventId, ids],
  );
  return r.length;
}

// Guests needed to hide a photo for review. One isn't enough: a single prank
// report shouldn't take someone's photo down.
export const REPORTS_TO_HIDE = 2;

/** A guest reports someone else's photo. Returns null if not allowed, else whether it is now hidden. */
export async function reportPhoto(eventId: string, guestId: string, photoId: string) {
  if (!UUID.test(photoId)) return null;
  const p = await one<{ guest_id: string | null; status: string }>("select guest_id, status from photos where id = $1 and event_id = $2", [photoId, eventId]);
  if (!p || p.guest_id === guestId || !["ready", "review"].includes(p.status)) return null;
  const added = await q("insert into photo_reports (photo_id, guest_id) values ($1, $2) on conflict do nothing returning photo_id", [photoId, guestId]);
  if (!added.length) return { hidden: p.status === "review" };
  const r = await one<{ status: string }>(
    `update photos set report_count = report_count + 1,
       status = case when status = 'ready' and approved_at is null and report_count + 1 >= ${REPORTS_TO_HIDE} then 'review' else status end,
       flag = case when status = 'ready' and approved_at is null and report_count + 1 >= ${REPORTS_TO_HIDE} then 'report' else flag end
     where id = $1 returning status`,
    [photoId],
  );
  return { hidden: r?.status === "review" };
}

export async function pendingReviewCount(eventId: string) {
  return (await one<{ n: number }>("select count(*)::int as n from photos where event_id = $1 and status = 'review'", [eventId]))?.n ?? 0;
}
