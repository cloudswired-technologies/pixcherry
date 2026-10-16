import "server-only";
import { cookies } from "next/headers";
import { one, q, tx } from "@/lib/db";
import { randomToken, sha256, sign, unsign } from "@/lib/crypto";
import type { EventWithConfig } from "@/lib/events";
import { clientIp } from "@/lib/rate-limit";

// Guests have no account: one signed cookie per event identifies the phone.
// Upload quota is counted on the guests row.

export type Guest = { id: string; event_id: string; name: string | null; upload_count: number; is_blocked: boolean; avatar_key?: string | null };

const cookieName = (eventId: string) => `pcg_${eventId.slice(0, 8)}`;
type GuestCookie = { g: string; e: string; t: string };

async function guestFromKey(eventId: string, key: string | undefined) {
  const c = unsign<GuestCookie>(key);
  if (!c || c.e !== eventId) return null;
  return one<Guest>(
    "select id, event_id, name, upload_count, is_blocked, avatar_key from guests where id = $1 and event_id = $2 and (token_hash = $3 or $3 = any(extra_token_hashes))",
    [c.g, eventId, sha256(c.t)],
  );
}

export async function currentGuest(eventId: string): Promise<Guest | null> {
  return guestFromKey(eventId, (await cookies()).get(cookieName(eventId))?.value);
}

/** The guest id in this browser's signed cookie, without a database read (for rate limits). */
export async function cookieGuestId(eventId: string) {
  const c = unsign<GuestCookie>((await cookies()).get(cookieName(eventId))?.value);
  return c && c.e === eventId ? c.g : null;
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

/** "2001:db8::1" -> its 8 groups, zero-padded and lower case. */
function v6Groups(ip: string) {
  const [head, tail] = ip.split("::");
  const h = head ? head.split(":") : [];
  const t = tail ? tail.split(":") : [];
  const full = tail === undefined ? h : [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill("0"), ...t];
  return full.map((x) => x.padStart(4, "0").toLowerCase());
}

/** This request's address: IPv4 (incl. "::ffff:1.2.3.4") or the IPv6 groups. */
async function requestAddress() {
  const ip = await clientIp();
  const v4 = ip.match(/(\d{1,3}(?:\.\d{1,3}){3})$/)?.[1];
  return v4 ? { v4 } : ip.includes(":") ? { v6: v6Groups(ip) } : { v4: ip };
}

/** Network of this request: IPv4 address, or IPv6 /64 (a Wi-Fi, or one phone's data line). */
async function netHash() {
  const a = await requestAddress();
  return sha256(`net:${a.v4 ?? a.v6!.slice(0, 4).join(":")}`).slice(0, 16);
}

/** The full IPv6 address (only one phone uses it at a time), or null on IPv4. */
async function addrHash() {
  const a = await requestAddress();
  return a.v6 ? sha256(`addr:${a.v6.join(":")}`).slice(0, 16) : null;
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

/** Same phone model, matched loosely: one browser may hide the GPU or the core count. */
function sameModel(a: DeviceInfo, b: DeviceInfo) {
  return a.s === b.s && Number(a.r) === Number(b.r) && a.t === b.t && Number(a.p) === Number(b.p) && (a.g === b.g || Number(a.c) === Number(b.c));
}

/** Creates the guest (respecting the event's guest limit) and sets the cookie. */
export async function joinEvent(e: EventWithConfig, name: string | null, device: DeviceInfo | null = null, samePhoneAs: string | null = null): Promise<JoinResult> {
  const token = randomToken();
  const [ip, net, addr] = await Promise.all([ipHash(), netHash(), addrHash()]);
  const guest = await tx(async (c) => {
    const ev = await one<{ guest_count: number }>("select guest_count from events where id = $1 for update", [e.id], c);
    if (!ev || ev.guest_count >= e.cfg.limits.max_guests) return null;
    const g = await one<Guest>(
      `insert into guests (event_id, name, token_hash, ip_hash, net_hash, addr_hash, device_info, same_phone_as) values ($1, $2, $3, $4, $5, $6, $7, $8)
       returning id, event_id, name, upload_count, is_blocked`,
      [e.id, name, sha256(token), ip, net, addr, device ? JSON.stringify(device) : null, samePhoneAs],
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

/** Keeps the guest's latest IPv6 address (phones change it now and then), so another browser of the same phone still matches. */
export async function noteGuestAddress(guestId: string) {
  const addr = await addrHash();
  if (addr) await q("update guests set addr_hash = $2 where id = $1 and addr_hash is distinct from $2", [guestId, addr]);
}

export type PhoneMatch = { id: string; name: string | null; photos: number; blocked: boolean };

/**
 * Who this phone already is in the album, when it comes back without the cookie
 * (another browser, cleared data, a private window).
 *  - match: an earlier guest with the same IPv6 address and the same phone model.
 *    Each phone has its own IPv6 address, even on a shared Wi-Fi. If guests on
 *    different phone models used the address, it's shared (a router or relay that
 *    puts phones behind one address): no match.
 *  - similar (IPv4 only): a guest with the same phone model on the same small network
 *    (maybe one person on two browsers): only flagged for the organiser, never blocked.
 *    When a third guest joins from the address it's a venue Wi-Fi: its flags are cleared.
 * IPv4 never matches: a whole venue or many telco customers share one address.
 */
export async function findSamePhone(eventId: string, device: DeviceInfo | null): Promise<{ match: PhoneMatch | null; similar: string | null }> {
  if (!device) return { match: null, similar: null };
  const [net, addr] = await Promise.all([netHash(), addrHash()]);
  if (addr) {
    const rows = await q<{ id: string; name: string | null; is_blocked: boolean; device_info: DeviceInfo | null; same_phone_as: string | null; photos: number }>(
      `select g.id, g.name, g.is_blocked, g.device_info, g.same_phone_as,
         (select count(*)::int from photos p where p.guest_id = g.id and p.status in ('ready','review')) as photos
       from guests g where g.event_id = $1 and g.addr_hash = $2 order by g.created_at limit 20`,
      [eventId, addr],
    );
    const models = rows.filter((r) => r.device_info);
    const shared = models.some((r) => !sameModel(r.device_info!, models[0].device_info!));
    const m = shared ? null : (models.find((r) => !r.same_phone_as && sameModel(r.device_info!, device)) ?? models.find((r) => sameModel(r.device_info!, device)));
    if (m) return { match: { id: m.id, name: m.name, photos: m.photos, blocked: m.is_blocked }, similar: null };
    return { match: null, similar: null };
  }
  const near = await q<{ id: string; device_info: DeviceInfo | null; n: number }>(
    "select g.id, g.device_info, count(*) over ()::int as n from guests g where g.event_id = $1 and g.net_hash = $2 and g.addr_hash is null order by g.created_at limit 2",
    [eventId, net],
  );
  if (near.length && near[0].n >= 2) {
    await q("update guests set same_phone_as = null where event_id = $1 and net_hash = $2 and addr_hash is null and same_phone_as is not null", [eventId, net]);
    return { match: null, similar: null };
  }
  return { match: null, similar: near.find((r) => r.device_info && sameModel(r.device_info, device))?.id ?? null };
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
