"use server";

import { getEventBySlug } from "@/lib/events";
import { cleanName, continueAsGuest, currentGuest, currentGuestKey, joinEvent, renameGuest, sameNameNearby } from "@/lib/guests";
import { uploadsOpen } from "@/lib/limits";
import { rateLimit } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";

export type JoinState = {
  error?: string;
  joined?: { id: string; name: string | null; uploaded: number; key: string | null };
  /** Same name, same phone/network as an earlier guest: ask "is this you?" before making a new one. */
  match?: { id: string; name: string; photos: number };
};

export async function join(slug: string, _: JoinState, fd: FormData): Promise<JoinState> {
  const e = await getEventBySlug(slug);
  if (!e || !uploadsOpen(e, e.cfg)) return { error: "Uploads for this event are closed." };
  const existing = await currentGuest(e.id);
  if (existing) return { joined: { id: existing.id, name: existing.name, uploaded: existing.upload_count, key: await currentGuestKey(e.id) } };
  // A whole venue may share one IP, so this cap is loose; Turnstile stops scripts.
  if (!(await rateLimit("join", 300, 10 * 60_000))) return { error: "Lots of people are joining right now. Please try again in a minute." };
  const name = e.ask_guest_name ? cleanName(fd.get("name")) : null;
  // "same" = "" (not asked yet) | "yes:<guest id>" | "new".
  const same = String(fd.get("same") ?? "");
  const match = name && same !== "new" ? await sameNameNearby(e.id, name) : null;
  if (match && !same) return { match }; // the bot-check token is only spent on the final submit
  if (!(await verifyTurnstile(String(fd.get("cf-turnstile-response") ?? "")))) return { error: "Please complete the check and try again." };
  if (match && same === `yes:${match.id}`) {
    const r = await continueAsGuest(e.id, match.id);
    if (r) return { joined: { id: r.guest.id, name: r.guest.name, uploaded: r.guest.upload_count, key: r.key } };
  }
  const r = await joinEvent(e, name);
  if (!r.ok) return { error: r.error };
  return { joined: { id: r.guest.id, name: r.guest.name, uploaded: 0, key: r.key } };
}

export async function rename(slug: string, name: string) {
  const e = await getEventBySlug(slug);
  if (!e) return null;
  const g = await currentGuest(e.id);
  if (!g) return null;
  const clean = cleanName(name);
  await renameGuest(g.id, clean);
  return clean;
}
