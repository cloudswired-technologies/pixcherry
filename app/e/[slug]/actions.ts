"use server";

import { getEventBySlug } from "@/lib/events";
import { cleanName, continueAsGuest, currentGuest, currentGuestKey, findSamePhone, joinEvent, nameClash, renameGuest } from "@/lib/guests";
import { uploadsOpen } from "@/lib/limits";
import { rateLimit } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";

export type JoinState = {
  error?: string;
  joined?: { id: string; name: string | null; uploaded: number; key: string | null };
  /**
   * Looks like an earlier guest on another browser of this phone: ask "is this you?".
   * strict = same phone (device + network) and the event allows one roll per phone, so no "someone else".
   */
  match?: { id: string; name: string | null; photos: number; byDevice: boolean; strict: boolean };
  /** Someone in this album already uses the name; suggestion is a free variant ("Shukry 2"). */
  nameTaken?: { name: string; suggestion: string | null };
};

export async function join(slug: string, _: JoinState, fd: FormData): Promise<JoinState> {
  const e = await getEventBySlug(slug);
  if (!e || !uploadsOpen(e, e.cfg)) return { error: "Uploads for this event are closed." };
  const existing = await currentGuest(e.id);
  if (existing) return { joined: { id: existing.id, name: existing.name, uploaded: existing.upload_count, key: await currentGuestKey(e.id) } };
  // A whole venue may share one IP, so this cap is loose; Turnstile stops scripts.
  if (!(await rateLimit("join", 300, 10 * 60_000))) return { error: "Lots of people are joining right now. Please try again in a minute." };
  const name = e.ask_guest_name ? cleanName(fd.get("name")) : null;
  const raw = String(fd.get("device") ?? "");
  const device = /^[0-9a-f]{32}$/.test(raw) ? raw : null;
  // "same" = "" (not asked yet) | "yes:<guest id>" | "new".
  const same = String(fd.get("same") ?? "");
  // Several signals together: same network + (same phone signature or same name).
  const found = await findSamePhone(e.id, name, device);
  if (found?.blocked && found.byDevice) return { error: "The hosts turned off uploads from this phone." };
  const match = found && !found.blocked ? { id: found.id, name: found.name, photos: found.photos, byDevice: found.byDevice, strict: found.byDevice && e.one_phone_one_roll } : null;
  if (match && !same) return { match }; // the bot-check token is only spent on the final submit
  if (match?.strict && same !== `yes:${match.id}`) return { match, error: "This phone already has a roll in this album." };
  // Names are unique in an album, so everyone can tell who's who.
  const continuing = !!match && same === `yes:${match.id}`;
  if (!continuing && name) {
    const clash = await nameClash(e.id, name);
    if (clash) return { nameTaken: { name, suggestion: clash.suggestion } };
  }
  if (!(await verifyTurnstile(String(fd.get("cf-turnstile-response") ?? "")))) return { error: "Please complete the check and try again." };
  if (match && same === `yes:${match.id}`) {
    const r = await continueAsGuest(e.id, match.id);
    if (r) return { joined: { id: r.guest.id, name: r.guest.name, uploaded: r.guest.upload_count, key: r.key } };
  }
  // "Someone else" on a matching phone is allowed (not strict) but flagged for the organiser.
  const r = await joinEvent(e, name, device, found?.byDevice ? found.id : null);
  if (!r.ok) return { error: r.error };
  return { joined: { id: r.guest.id, name: r.guest.name, uploaded: 0, key: r.key } };
}

export async function rename(slug: string, name: string): Promise<{ name?: string | null; error?: string; suggestion?: string | null }> {
  const e = await getEventBySlug(slug);
  if (!e) return { error: "Album not found." };
  const g = await currentGuest(e.id);
  if (!g) return { error: "Please join first." };
  const clean = cleanName(name);
  if (clean) {
    const clash = await nameClash(e.id, clean, g.id);
    if (clash) return { error: `Someone here is already called ${clean}.`, suggestion: clash.suggestion };
  }
  await renameGuest(g.id, clean);
  return { name: clean };
}
