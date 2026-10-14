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

export async function currentGuest(eventId: string): Promise<Guest | null> {
  const c = unsign<GuestCookie>((await cookies()).get(cookieName(eventId))?.value);
  if (!c || c.e !== eventId) return null;
  return one<Guest>(
    "select id, event_id, name, upload_count, is_blocked from guests where id = $1 and event_id = $2 and token_hash = $3",
    [c.g, eventId, sha256(c.t)],
  );
}

export type JoinResult = { ok: true; guest: Guest } | { ok: false; error: string };

/** Creates the guest (respecting the event's guest limit) and sets the cookie. */
export async function joinEvent(e: EventWithConfig, name: string | null): Promise<JoinResult> {
  const token = randomToken();
  const ip = await clientIp();
  const guest = await tx(async (c) => {
    const ev = await one<{ guest_count: number }>("select guest_count from events where id = $1 for update", [e.id], c);
    if (!ev || ev.guest_count >= e.cfg.limits.max_guests) return null;
    const g = await one<Guest>(
      "insert into guests (event_id, name, token_hash, ip_hash) values ($1, $2, $3, $4) returning id, event_id, name, upload_count, is_blocked",
      [e.id, name, sha256(token), sha256(`ip:${ip}`).slice(0, 16)],
      c,
    );
    await q("update events set guest_count = guest_count + 1 where id = $1", [e.id], c);
    return g;
  });
  if (!guest) return { ok: false, error: "This event has reached its guest limit. Please tell the organiser." };
  (await cookies()).set(cookieName(e.id), sign({ g: guest.id, e: e.id, t: token } satisfies GuestCookie), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 400 * 86400,
  });
  return { ok: true, guest };
}

export async function renameGuest(guestId: string, name: string | null) {
  await q("update guests set name = $2 where id = $1", [guestId, name]);
}

export function cleanName(raw: unknown) {
  const s = String(raw ?? "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 60);
  return s || null;
}
