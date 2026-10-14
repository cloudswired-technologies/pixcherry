"use server";

import { getEventBySlug } from "@/lib/events";
import { cleanName, currentGuest, joinEvent, renameGuest } from "@/lib/guests";
import { uploadsOpen } from "@/lib/limits";
import { rateLimit } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";

export type JoinState = { error?: string; joined?: { name: string | null; uploaded: number } };

export async function join(slug: string, _: JoinState, fd: FormData): Promise<JoinState> {
  const e = await getEventBySlug(slug);
  if (!e || !uploadsOpen(e, e.cfg)) return { error: "Uploads for this event are closed." };
  const existing = await currentGuest(e.id);
  if (existing) return { joined: { name: existing.name, uploaded: existing.upload_count } };
  // A whole venue may share one IP, so this cap is loose; Turnstile stops scripts.
  if (!(await rateLimit("join", 300, 10 * 60_000))) return { error: "Lots of people are joining right now. Please try again in a minute." };
  if (!(await verifyTurnstile(String(fd.get("cf-turnstile-response") ?? "")))) return { error: "Please complete the check and try again." };
  const name = e.ask_guest_name ? cleanName(fd.get("name")) : null;
  const r = await joinEvent(e, name);
  if (!r.ok) return { error: r.error };
  return { joined: { name: r.guest.name, uploaded: 0 } };
}

export async function rename(slug: string, name: string) {
  const e = await getEventBySlug(slug);
  if (!e) return;
  const g = await currentGuest(e.id);
  if (g) await renameGuest(g.id, cleanName(name));
}
