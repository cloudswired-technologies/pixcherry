import "server-only";
import { one, q, tx } from "@/lib/db";
import { deletePhoto } from "@/lib/photos";
import { deleteObject, photoKeys } from "@/lib/storage";

// Organiser tools for guests: list with activity, remove (with everything they
// added), and merge two guests who turn out to be one person.

export type GuestRow = {
  id: string;
  name: string | null;
  created_at: Date;
  last_seen_at: Date;
  is_blocked: boolean;
  photos: number;
  hearts: number;
  wishes: number;
  same_phone_as: string | null;
  same_phone_name: string | null;
  avatar_key: string | null;
};

export async function listGuests(eventId: string) {
  return q<GuestRow>(
    `select g.id, g.name, g.avatar_key, g.created_at, g.last_seen_at, g.is_blocked, g.same_phone_as, o.name as same_phone_name,
       (select count(*)::int from photos p where p.guest_id = g.id and p.status in ('ready','review')) as photos,
       (select coalesce(sum(p.vote_count), 0)::int from photos p where p.guest_id = g.id and p.status = 'ready') as hearts,
       (select count(*)::int from wishes w where w.guest_id = g.id) as wishes
     from guests g left join guests o on o.id = g.same_phone_as
     where g.event_id = $1 order by g.created_at desc limit 2000`,
    [eventId],
  );
}

/** Removes a guest and everything they added (photos, wishes, hearts). Frees their guest slot. */
export async function removeGuest(eventId: string, guestId: string) {
  const g = await one<{ id: string }>("select id from guests where id = $1 and event_id = $2", [guestId, eventId]);
  if (!g) return false;
  const photos = await q<{ id: string }>("select id from photos where guest_id = $1 and status in ('ready','review')", [guestId]);
  for (const p of photos) await deletePhoto(eventId, p.id);
  // Photos still on their way up would otherwise land later, without an owner.
  const inFlight = await q<{ id: string }>(
    "update photos set status = 'failed', error = 'guest removed', locked_at = null where guest_id = $1 and status in ('pending','uploaded','processing') returning id",
    [guestId],
  );
  for (const p of inFlight) await deleteObject(photoKeys(eventId, p.id).incoming).catch(() => {});
  if (inFlight.length) await q("update events set slot_count = greatest(0, slot_count - $2) where id = $1", [eventId, inFlight.length]);
  await tx(async (c) => {
    // Their hearts on other people's photos go too; keep the counters right.
    await q(
      "update photos p set vote_count = greatest(0, p.vote_count - 1) from photo_votes v where v.photo_id = p.id and v.guest_id = $1",
      [guestId],
      c,
    );
    await q("delete from wishes where guest_id = $1", [guestId], c);
    await q("delete from guests where id = $1", [guestId], c); // votes cascade
    await q("update events set guest_count = greatest(0, guest_count - 1) where id = $1", [eventId], c);
  });
  return true;
}

/**
 * Moves everything from one guest into another (same person, two browsers).
 * The other browser stays signed in, now as the merged guest.
 */
export async function mergeGuests(eventId: string, fromId: string, intoId: string) {
  if (fromId === intoId) return false;
  return tx(async (c) => {
    const both = await q<{ id: string; name: string | null; token_hash: string; extra_token_hashes: string[]; upload_count: number }>(
      "select id, name, token_hash, extra_token_hashes, upload_count from guests where event_id = $1 and id = any($2::uuid[]) for update",
      [eventId, [fromId, intoId]],
      c,
    );
    const from = both.find((g) => g.id === fromId);
    const into = both.find((g) => g.id === intoId);
    if (!from || !into) return false;
    await q("update photos set guest_id = $2 where guest_id = $1", [fromId, intoId], c);
    await q("update wishes set guest_id = $2, name = $3 where guest_id = $1", [fromId, intoId, into.name], c);
    // A heart from both on the same photo counts once.
    await q(
      `update photos p set vote_count = greatest(0, p.vote_count - 1) from photo_votes v
       where v.photo_id = p.id and v.guest_id = $1 and exists (select 1 from photo_votes w where w.photo_id = v.photo_id and w.guest_id = $2)`,
      [fromId, intoId],
      c,
    );
    await q(
      "delete from photo_votes v where v.guest_id = $1 and exists (select 1 from photo_votes w where w.photo_id = v.photo_id and w.guest_id = $2)",
      [fromId, intoId],
      c,
    );
    await q("update photo_votes set guest_id = $2 where guest_id = $1", [fromId, intoId], c);
    await q("update guests set same_phone_as = null where same_phone_as = $1", [fromId], c);
    const keys = [from.token_hash, ...from.extra_token_hashes, ...into.extra_token_hashes].slice(0, 8);
    await q("delete from guests where id = $1", [fromId], c);
    await q("update guests set upload_count = upload_count + $2, extra_token_hashes = $3, same_phone_as = null where id = $1", [intoId, from.upload_count, keys], c);
    await q("update events set guest_count = greatest(0, guest_count - 1) where id = $1", [eventId], c);
    return true;
  });
}
