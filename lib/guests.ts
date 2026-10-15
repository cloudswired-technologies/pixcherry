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

/** "2001:db8:a:b::1" -> "2001:0db8:000a:000b" (the /64 a Wi-Fi or a phone's data line keeps all day). */
function v6Prefix(ip: string) {
  const [head, tail] = ip.split("::");
  const h = head ? head.split(":") : [];
  const t = tail ? tail.split(":") : [];
  const full = tail === undefined ? h : [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill("0"), ...t];
  return full.slice(0, 4).map((x) => x.padStart(4, "0").toLowerCase()).join(":");
}

/** Network of this request: IPv4 address, or IPv6 /64 (privacy addresses rotate inside it). */
async function netHash() {
  const ip = await clientIp();
  const v4 = ip.match(/(\d{1,3}(?:\.\d{1,3}){3})$/)?.[1];
  return sha256(`net:${v4 ?? (ip.includes(":") ? v6Prefix(ip) : ip)}`).slice(0, 16);
}

/** Device signals sent by the phone (lib/client/device.ts), validated and trimmed. */
export type DeviceInfo = { s: string; r: number; t: string; p: number; c: number; g: string; o: string };
export function parseDevice(raw: unknown): DeviceInfo | null {
  try {
    const d = JSON.parse(String(raw ?? "")) as Partial<DeviceInfo>;
    if (typeof d.s !== "string" || !/^\d{2,5}x\d{2,5}$/.test(d.s)) return null;
    return {
      s: d.s,
      r: Math.round(Number(d.r) * 100) / 100 || 0,
      t: String(d.t ?? "").slice(0, 60),
      p: Math.min(99, Math.max(0, Math.round(Number(d.p) || 0))),
      c: Math.min(512, Math.max(0, Math.round(Number(d.c) || 0))),
      g: String(d.g ?? "").slice(0, 80),
      o: String(d.o ?? "").slice(0, 20),
    };
  } catch {
    return null;
  }
}

/** Creates the guest (respecting the event's guest limit) and sets the cookie. */
export async function joinEvent(e: EventWithConfig, name: string | null, device: DeviceInfo | null = null, samePhoneAs: string | null = null): Promise<JoinResult> {
  const token = randomToken();
  const [ip, net] = await Promise.all([ipHash(), netHash()]);
  const guest = await tx(async (c) => {
    const ev = await one<{ guest_count: number }>("select guest_count from events where id = $1 for update", [e.id], c);
    if (!ev || ev.guest_count >= e.cfg.limits.max_guests) return null;
    const g = await one<Guest>(
      `insert into guests (event_id, name, token_hash, ip_hash, net_hash, device_info, same_phone_as) values ($1, $2, $3, $4, $5, $6, $7)
       returning id, event_id, name, upload_count, is_blocked`,
      [e.id, name, sha256(token), ip, net, device ? JSON.stringify(device) : null, samePhoneAs],
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

export type PhoneMatch = { id: string; name: string | null; photos: number; blocked: boolean; byDevice: boolean; sameNet: boolean };

/**
 * An earlier guest who is probably this person on another browser of the same phone.
 * Signals, matched loosely and together:
 *  - device: same screen, pixel ratio, time zone and touch points, plus the same GPU or
 *    the same CPU core count (one browser may hide one of them);
 *  - network: same IPv4, or same IPv6 /64;
 *  - name: same name (case-insensitive) on the same network.
 */
export async function findSamePhone(eventId: string, name: string | null, device: DeviceInfo | null): Promise<PhoneMatch | null> {
  if (!name && !device) return null;
  const [ip, net] = await Promise.all([ipHash(), netHash()]);
  const r = await one<{ id: string; name: string | null; photos: number; is_blocked: boolean; by_device: boolean; same_net: boolean }>(
    `select * from (
       select g.id, g.name, g.is_blocked, g.upload_count, g.created_at,
         (g.net_hash = $3 or g.ip_hash = $2) as same_net,
         coalesce($5::jsonb is not null and g.device_info is not null
           and g.device_info->>'s' = $5::jsonb->>'s' and g.device_info->>'r' = $5::jsonb->>'r'
           and g.device_info->>'t' = $5::jsonb->>'t' and g.device_info->>'p' = $5::jsonb->>'p'
           and (g.device_info->>'g' = $5::jsonb->>'g' or g.device_info->>'c' = $5::jsonb->>'c'), false) as by_device,
         (select count(*)::int from photos p where p.guest_id = g.id and p.status in ('ready','review')) as photos
       from guests g where g.event_id = $1 and g.same_phone_as is null
     ) x
     where x.by_device or (x.same_net and $4::text is not null and lower(x.name) = lower($4))
     order by x.by_device desc, x.same_net desc, x.upload_count desc, x.created_at limit 1`,
    [eventId, ip, net, name, device ? JSON.stringify(device) : null],
  );
  return r ? { id: r.id, name: r.name, photos: r.photos, blocked: r.is_blocked, byDevice: r.by_device, sameNet: r.same_net } : null;
}

/**
 * Names are unique per album (ignoring case), so People folders, leaderboards and
 * captions never show two "Shukry". Returns a free suggestion when taken.
 */
export async function nameClash(eventId: string, name: string, exceptGuestId?: string) {
  const taken = await q<{ n: string }>(
    `select lower(name) n from guests where event_id = $1 and id <> coalesce($3::uuid, '00000000-0000-0000-0000-000000000000')
       and (lower(name) = lower($2) or lower(name) like lower($2) || ' %')`,
    [eventId, name, exceptGuestId ?? null],
  );
  const used = new Set(taken.map((t) => t.n));
  if (!used.has(name.toLowerCase())) return null;
  for (let i = 2; i < 100; i++) {
    const s = `${name.slice(0, 56)} ${i}`;
    if (!used.has(s.toLowerCase())) return { suggestion: s };
  }
  return { suggestion: null };
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
  // Wishes keep a copy of the name; follow the change.
  await q("update wishes set name = $2 where guest_id = $1", [guestId, name]);
}

export function cleanName(raw: unknown) {
  const s = String(raw ?? "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 60);
  return s || null;
}
