import "server-only";
import { one, q, tx } from "@/lib/db";
import { photoKeys, publicUrl } from "@/lib/storage";

// Guest engagement: snap missions, wishes, hearts, people folders, leaderboards.

const UUID = /^[0-9a-f-]{36}$/;

export type Mission = { id: string; title: string; emoji: string | null; sort: number; count: number };

export async function listMissions(eventId: string): Promise<Mission[]> {
  return q<Mission>(
    `select m.id, m.title, m.emoji, m.sort,
       (select count(*)::int from photos p where p.mission_id = m.id and p.status = 'ready') as count
     from event_missions m where m.event_id = $1 order by m.sort, m.created_at`,
    [eventId],
  );
}

/** Mission ids this guest has at least one photo for (any non-failed state). */
export async function missionsDoneBy(guestId: string) {
  return (
    await q<{ mission_id: string }>(
      "select distinct mission_id from photos where guest_id = $1 and mission_id is not null and status in ('pending','uploaded','processing','ready','review')",
      [guestId],
    )
  ).map((r) => r.mission_id);
}

export const MISSION_PRESETS: { emoji: string; title: string }[] = [
  { emoji: "🤳", title: "Selfie with the couple" },
  { emoji: "👗", title: "Best dressed guest" },
  { emoji: "👨‍👩‍👧", title: "Family group photo" },
  { emoji: "👶", title: "The cutest little guest" },
  { emoji: "😂", title: "A big candid laugh" },
  { emoji: "🍛", title: "The food you loved" },
  { emoji: "💐", title: "Decor details" },
  { emoji: "💃", title: "Best dance move" },
];

// ------------------------------------------------------------------ wishes

export type Wish = { id: string; name: string | null; message: string; at: string; photo: string | null; hidden: boolean };

type WishRow = { id: string; name: string | null; message: string; created_at: Date; photo_id: string | null; is_hidden: boolean; event_id: string; photo_status: string | null };

function toWish(r: WishRow): Wish {
  return {
    id: r.id,
    name: r.name,
    message: r.message,
    at: new Date(r.created_at).toISOString(),
    photo: r.photo_id && r.photo_status === "ready" ? publicUrl(photoKeys(r.event_id, r.photo_id).sm) : null,
    hidden: r.is_hidden,
  };
}

export async function listWishes(eventId: string, opts: { includeHidden?: boolean; since?: string | null; limit?: number } = {}) {
  const params: unknown[] = [eventId];
  let where = "w.event_id = $1";
  if (!opts.includeHidden) where += " and not w.is_hidden";
  if (opts.since && !Number.isNaN(Date.parse(opts.since))) where += ` and w.created_at > $${params.push(opts.since)}::timestamptz`;
  const rows = await q<WishRow>(
    `select w.id, w.name, w.message, w.created_at, w.photo_id, w.is_hidden, w.event_id, p.status as photo_status
     from wishes w left join photos p on p.id = w.photo_id
     where ${where} order by w.created_at desc limit ${Math.min(opts.limit ?? 100, 500)}`,
    params,
  );
  return rows.map(toWish);
}

export function cleanMessage(raw: unknown) {
  return String(raw ?? "").replace(/[\u0000-\u0008\u000b-\u001f<>]/g, "").replace(/\n{3,}/g, "\n\n").trim().slice(0, 500);
}

export async function addWish(eventId: string, guest: { id: string; name: string | null }, message: string, photoId: string | null) {
  // Only the guest's own photo can be attached.
  const photo = photoId && UUID.test(photoId)
    ? await one<{ id: string }>("select id from photos where id = $1 and event_id = $2 and guest_id = $3", [photoId, eventId, guest.id])
    : null;
  const r = await one<WishRow>(
    `insert into wishes (event_id, guest_id, name, message, photo_id) values ($1, $2, $3, $4, $5)
     returning id, name, message, created_at, photo_id, is_hidden, event_id, null::text as photo_status`,
    [eventId, guest.id, guest.name, message, photo?.id ?? null],
  );
  return toWish(r!);
}

export async function setWishHidden(eventId: string, wishId: string, hidden: boolean) {
  await q("update wishes set is_hidden = $3 where id = $2 and event_id = $1", [eventId, wishId, hidden]);
}

// ------------------------------------------------------------------ hearts

/** Toggles the guest's heart on a photo. Returns the new state and count. */
export async function toggleVote(eventId: string, guestId: string, photoId: string) {
  if (!UUID.test(photoId)) return null;
  return tx(async (c) => {
    const p = await one<{ id: string }>("select id from photos where id = $1 and event_id = $2 and status = 'ready' for update", [photoId, eventId], c);
    if (!p) return null;
    const removed = await q("delete from photo_votes where photo_id = $1 and guest_id = $2 returning photo_id", [photoId, guestId], c);
    if (!removed.length) await q("insert into photo_votes (photo_id, guest_id) values ($1, $2)", [photoId, guestId], c);
    const r = await one<{ vote_count: number }>(
      "update photos set vote_count = greatest(0, vote_count + $2) where id = $1 returning vote_count",
      [photoId, removed.length ? -1 : 1],
      c,
    );
    return { voted: !removed.length, votes: r!.vote_count };
  });
}

// ------------------------------------------------------------------ people + leaderboards

export type Person = { id: string; name: string | null; count: number; cover: string | null; hearts: number };

/** Uploaders with at least one visible photo, most photos first ("folders"). */
export async function listPeople(eventId: string, limit = 200): Promise<Person[]> {
  const rows = await q<{ id: string; name: string | null; count: number; hearts: number; cover_id: string | null }>(
    `select g.id, g.name, count(p.id)::int as count, coalesce(sum(p.vote_count), 0)::int as hearts,
       (select p2.id from photos p2 where p2.guest_id = g.id and p2.status = 'ready' order by p2.vote_count desc, p2.ready_at desc limit 1) as cover_id
     from guests g join photos p on p.guest_id = g.id and p.status = 'ready'
     where g.event_id = $1
     group by g.id order by count(p.id) desc, g.created_at limit ${Math.min(limit, 500)}`,
    [eventId],
  );
  return rows.map((r) => ({ id: r.id, name: r.name, count: r.count, hearts: r.hearts, cover: r.cover_id ? publicUrl(photoKeys(eventId, r.cover_id).sm) : null }));
}

export type Stats = {
  photos: number;
  guests: number;
  wishes: number;
  topSnappers: { id: string; name: string | null; count: number }[];
  topPhotos: { id: string; sm: string; md: string; votes: number; by: string | null }[];
};

export async function eventStats(eventId: string): Promise<Stats> {
  const [counts, snappers, top] = await Promise.all([
    one<{ photos: number; guests: number; wishes: number }>(
      `select (select count(*)::int from photos where event_id = $1 and status = 'ready') as photos,
         (select count(distinct guest_id)::int from photos where event_id = $1 and status = 'ready') as guests,
         (select count(*)::int from wishes where event_id = $1 and not is_hidden) as wishes`,
      [eventId],
    ),
    q<{ id: string; name: string | null; count: number }>(
      `select g.id, g.name, count(*)::int as count from photos p join guests g on g.id = p.guest_id
       where p.event_id = $1 and p.status = 'ready' group by g.id order by count(*) desc, min(p.ready_at) limit 5`,
      [eventId],
    ),
    q<{ id: string; vote_count: number; name: string | null }>(
      `select p.id, p.vote_count, g.name from photos p left join guests g on g.id = p.guest_id
       where p.event_id = $1 and p.status = 'ready' and p.vote_count > 0 order by p.vote_count desc, p.ready_at limit 5`,
      [eventId],
    ),
  ]);
  return {
    photos: counts?.photos ?? 0,
    guests: counts?.guests ?? 0,
    wishes: counts?.wishes ?? 0,
    topSnappers: snappers,
    topPhotos: top.map((t) => {
      const k = photoKeys(eventId, t.id);
      return { id: t.id, sm: publicUrl(k.sm), md: publicUrl(k.md), votes: t.vote_count, by: t.name };
    }),
  };
}
