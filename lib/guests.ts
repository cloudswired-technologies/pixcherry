import "server-only";
import { cookies } from "next/headers";
import { one, q, tx } from "@/lib/db";
import { randomToken, sha256, sign, unsign } from "@/lib/crypto";
import type { EventWithConfig } from "@/lib/events";
import { clientIp } from "@/lib/rate-limit";

// Guests have no account: one signed cookie per event identifies the phone.
// Upload quota is counted on the guests row.

export type Guest = { id: string; event_id: string; name: string | null; upload_count: number; is_blocked: boolean };

const cookieName = (eventId: string) => `pcg_${eventId.slice(0, 8)}`;
type GuestCookie = { g: string; e: string; t: string };

async function guestFromKey(eventId: string, key: string | undefined) {
  const c = unsign<GuestCookie>(key);
  if (!c || c.e !== eventId) return null;
  return one<Guest>(
    "select id, event_id, name, upload_count, is_blocked from guests where id = $1 and event_id = $2 and (token_hash = $3 or $3 = any(extra_token_hashes))",
    [c.g, eventId, sha256(c.t)],
  );
}

export async function currentGuest(eventId: string): Promise<Guest | null> {
  return guestFromKey(eventId, (await cookies()).get(cookieName(eventId))?.value);
}

/**
 * The guest's signed session, for the home-screen app: an installed web app
 * (iOS especially) doesn't share the browser's cookies, so its start link carries this.
 */
export async function currentGuestKey(eventId: string) {
  const v = (await cookies()).get(cookieName(eventId))?.value;
  return v && (await guestFromKey(eventId, v)) ? v : null;
}

/** Signs this browser in as the guest the key belongs to. */
export async function resumeGuest(eventId: string, key: string) {
  const g = await guestFromKey(eventId, key);
  if (g) await setGuestCookie(eventId, key);
  return g;
}

async function setGuestCookie(eventId: string, value: string) {
  (await cookies()).set(cookieName(eventId), value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 400 * 86400,
  });
}

export type JoinResult = { ok: true; guest: Guest; key: string } | { ok: false; error: string };

const ipHash = async () => sha256(`ip:${await clientIp()}`).slice(0, 16);

/** Creates the guest (respecting the event's guest limit) and sets the cookie. */
export async function joinEvent(e: EventWithConfig, name: string | null, device: string | null = null, samePhoneAs: string | null = null): Promise<JoinResult> {
  const token = randomToken();
  const ip = await ipHash();
  const guest = await tx(async (c) => {
    const ev = await one<{ guest_count: number }>("select guest_count from events where id = $1 for update", [e.id], c);
    if (!ev || ev.guest_count >= e.cfg.limits.max_guests) return null;
    const g = await one<Guest>(
      `insert into guests (event_id, name, token_hash, ip_hash, device_hash, same_phone_as) values ($1, $2, $3, $4, $5, $6)
       returning id, event_id, name, upload_count, is_blocked`,
      [e.id, name, sha256(token), ip, device, samePhoneAs],
      c,
    );
    await q("update events set guest_count = guest_count + 1 where id = $1", [e.id], c);
    return g;
  });
  if (!guest) return { ok: false, error: "This event has reached its guest limit. Please tell the organiser." };
  const key = sign({ g: guest.id, e: e.id, t: token } satisfies GuestCookie);
  await setGuestCookie(e.id, key);
  return { ok: true, guest, key };
}

export type PhoneMatch = { id: string; name: string | null; photos: number; blocked: boolean; byDevice: boolean };

/**
 * An earlier guest who is probably this person on another browser of the same
 * phone. Always needs the same network, plus either the same device signature
 * or the same name. Device matches rank first.
 */
export async function findSamePhone(eventId: string, name: string | null, device: string | null): Promise<PhoneMatch | null> {
  if (!name && !device) return null;
  const r = await one<{ id: string; name: string | null; photos: number; is_blocked: boolean; by_device: boolean }>(
    `select g.id, g.name, g.is_blocked, (g.device_hash is not distinct from $4 and $4 is not null) as by_device,
       (select count(*)::int from photos p where p.guest_id = g.id and p.status in ('ready','review')) as photos
     from guests g
     where g.event_id = $1 and g.ip_hash = $2 and g.same_phone_as is null
       and (($4::text is not null and g.device_hash = $4) or ($3::text is not null and lower(g.name) = lower($3)))
     order by (g.device_hash = $4) desc nulls last, g.upload_count desc, g.created_at limit 1`,
    [eventId, await ipHash(), name, device],
  );
  return r ? { id: r.id, name: r.name, photos: r.photos, blocked: r.is_blocked, byDevice: r.by_device } : null;
}

/** Signs this browser in as an existing guest (another browser keeps its own session). */
export async function continueAsGuest(eventId: string, guestId: string) {
  const token = randomToken();
  const g = await one<Guest>(
    `update guests set extra_token_hashes = (array_prepend($3, extra_token_hashes))[1:5]
     where id = $1 and event_id = $2 and not is_blocked returning id, event_id, name, upload_count, is_blocked`,
    [guestId, eventId, sha256(token)],
  );
  if (!g) return null;
  const key = sign({ g: g.id, e: eventId, t: token } satisfies GuestCookie);
  await setGuestCookie(eventId, key);
  return { guest: g, key };
}

export async function renameGuest(guestId: string, name: string | null) {
  await q("update guests set name = $2 where id = $1", [guestId, name]);
  // Wishes and comments keep a copy of the name; follow the change.
  await q("update wishes set name = $2 where guest_id = $1", [guestId, name]);
  await q("update photo_comments set name = $2 where guest_id = $1", [guestId, name]);
}

export function cleanName(raw: unknown) {
  const s = String(raw ?? "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 60);
  return s || null;
}
