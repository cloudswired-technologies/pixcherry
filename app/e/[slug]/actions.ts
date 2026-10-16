"use server";

import { getEventBySlug } from "@/lib/events";
import { cleanName, continueAsGuest, currentGuest, currentGuestKey, findSamePhone, joinEvent, nameClash, parseDevice, renameGuest } from "@/lib/guests";
import { uploadsOpen } from "@/lib/limits";
import { rateLimit } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";

export type JoinState = {
  error?: string;
  joined?: { id: string; name: string | null; uploaded: number; key: string | null };
  /**
   * This phone is already in the album (same IPv6 address, same phone model) on another
   * browser: carry on as that guest. strict = the event allows one roll per phone, so
   * there is no "someone else" choice.
   */
  match?: { id: string; name: string | null; photos: number; strict: boolean };
  /** Someone in this album already uses the name; suggestion is a free variant ("Shukry 2"). */
  nameTaken?: { name: string; suggestion: string | null };
};

export async function join(slug: string, _: JoinState, fd: FormData): Promise<JoinState> {
  const e = await getEventBySlug(slug);
  if (!e || !uploadsOpen(e, e.cfg)) return { error: "Uploads for this event are closed." };
  const existing = await currentGuest(e.id);
  if (existing) return { joined: { id: existing.id, name: existing.name, uploaded: existing.upload_count, key: await currentGuestKey(e.id) } };
  // A whole venue may share one IP, so this cap is only against floods; Turnstile stops scripts.
  if (!(await rateLimit("join", 3000, 10 * 60_000))) return { error: "Lots of people are joining right now. Please try again in a minute." };
  const name = e.ask_guest_name ? cleanName(fd.get("name")) : null;
  const device = parseDevice(fd.get("device"));
  // "same" = "" (not asked yet) | "yes:<guest id>" | "new".
  const same = String(fd.get("same") ?? "");
  const { match: found, similar } = await findSamePhone(e.id, device);
  if (found?.blocked) return { error: "The hosts turned off uploads from this phone." };
  const match = found ? { id: found.id, name: found.name, photos: found.photos, strict: e.one_phone_one_roll } : null;
  if (match && !same) return { match }; // the bot-check token is only spent on the final submit
  if (match?.strict && same !== `yes:${match.id}`) return { match, error: "This phone already has a roll in this album." };
  // Names are unique in an album, so everyone can tell who's who.
  const continuing = !!match && same === `yes:${match.id}`;
  if (!continuing && name) {
    const clash = await nameClash(e.id, name);
    if (clash) return { nameTaken: { name, suggestion: clash.suggestion } };
  }
  if (!(await verifyTurnstile(String(fd.get("cf-turnstile-response") ?? "")))) return { error: "Please complete the check and try again." };
  if (match && continuing) {
    const r = await continueAsGuest(e.id, match.id);
    if (r) return { joined: { id: r.guest.id, name: r.guest.name, uploaded: r.guest.upload_count, key: r.key } };
  }
  // "Someone else" on this phone (event allows it), or a look-alike phone nearby: in, and flagged for the organiser.
  const r = await joinEvent(e, name, device, match?.id ?? similar);
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
