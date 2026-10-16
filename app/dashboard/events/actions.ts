"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import sharp from "sharp";
import { requireUser } from "@/lib/auth";
import { one, q, tx } from "@/lib/db";
import { getManagedEvent, refreshDeletion, slugFromName, slugTaken, uniqueSlug } from "@/lib/events";
import { slugProblem } from "@/lib/slug";
import { parseLocalDateTime } from "@/lib/format";
import { datesLocked } from "@/lib/limits";
import { MISSION_IDEAS, setWishHidden } from "@/lib/engage";
import { cleanTags } from "@/lib/tags";
import { approvePhotos, deletePhoto } from "@/lib/photos";
import { PaymentError, startPurchase, type PurchaseKind } from "@/lib/payments";
import { rateLimit } from "@/lib/rate-limit";
import { audit } from "@/lib/settings";
import { deleteObject, deletePrefix, putObject } from "@/lib/storage";
import { purgeEvent } from "@/lib/jobs";
import { mergeGuests, removeGuest } from "@/lib/guest-admin";

export type FormState = { error?: string; ok?: string };

class InputError extends Error {}

async function managed(id: string) {
  const user = await requireUser();
  const e = await getManagedEvent(id, user);
  if (!e) redirect("/dashboard");
  return { user, e };
}

/** The link the organiser typed (empty = make one from the name). */
async function readSlug(fd: FormData, exceptEventId?: string) {
  const s = String(fd.get("slug") ?? "").trim().toLowerCase().replace(/\s+/g, "-");
  if (!s) return { slug: null } as const;
  const problem = slugProblem(s);
  if (problem) return { error: `Event link: ${problem}` } as const;
  if (await slugTaken(s, exceptEventId)) return { error: `The link “${s}” is already taken. Try adding the date or a word.` } as const;
  return { slug: s } as const;
}

function readDetails(fd: FormData) {
  const name = String(fd.get("name") ?? "").trim().slice(0, 120);
  const description = String(fd.get("description") ?? "").trim().slice(0, 2000);
  const venue = String(fd.get("venue") ?? "").replace(/[<>]/g, "").trim().slice(0, 120);
  const thankYou = String(fd.get("thank_you") ?? "").replace(/[<>]/g, "").trim().slice(0, 1000);
  const tags = cleanTags(String(fd.get("suggested_tags") ?? ""), 12);
  const starts = parseLocalDateTime(String(fd.get("starts_at") ?? ""));
  const ends = parseLocalDateTime(String(fd.get("ends_at") ?? ""));
  if (!name) return { error: "Give your event a name." } as const;
  if (!starts || !ends) return { error: "Enter when the event starts and ends." } as const;
  if (ends < starts) return { error: "The end must be after the start." } as const;
  if (ends.getTime() - starts.getTime() > 14 * 86400_000) return { error: "An event can last at most 14 days." } as const;
  return { name, description, venue, thankYou, tags, starts, ends } as const;
}

export async function createEvent(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!(await rateLimit("create-event", 20, 3600_000, user.id))) return { error: "Too many events created. Try again later." };
  const d = readDetails(fd);
  if ("error" in d) return { error: d.error };
  if (d.ends.getTime() < Date.now() - 86400_000) return { error: "That date has already passed." };
  // A link filled in from the name gets -2, -3… when taken; one the organiser typed must be free.
  const auto = fd.get("slug_auto") === "1";
  const picked = auto ? { slug: null } : await readSlug(fd);
  if ("error" in picked) return { error: picked.error };
  const slug = picked.slug ?? (await slugFromName(auto ? String(fd.get("slug") ?? "") || d.name : d.name));
  const row = await one<{ id: string }>(
    "insert into events (owner_id, slug, name, description, venue, starts_at, ends_at) values ($1,$2,$3,$4,$5,$6,$7) returning id",
    [user.id, slug, d.name, d.description, d.venue, d.starts, d.ends],
  );
  const plan = String(fd.get("plan") ?? "");
  redirect(`/dashboard/events/${row!.id}/checkout${/^[a-z0-9-]{2,40}$/.test(plan) ? `?plan=${plan}` : ""}`);
}

export async function updateEvent(id: string, _: FormState, fd: FormData): Promise<FormState> {
  const { user, e } = await managed(id);
  if (e.purged_at) return { error: "This event's photos were deleted; it can't be changed." };
  const d = readDetails(fd);
  if ("error" in d) return { error: d.error };
  // Once a paid event has started its dates are fixed: one payment = one event, and the
  // deletion date can't be pushed out by moving the event. Before that they can change,
  // but not into the past.
  const locked = datesLocked(e);
  const starts = locked ? new Date(e.starts_at) : d.starts;
  const ends = locked ? new Date(e.ends_at) : d.ends;
  if (!locked && e.paid_at && starts.getTime() < Date.now() - 60_000) {
    return { error: "The start can't be in the past. Choose the real start time of your event." };
  }
  const branding = e.cfg.features.custom_branding;
  const accent = String(fd.get("accent_color") ?? "");
  const picked = fd.has("slug") ? await readSlug(fd, e.id) : { slug: null };
  if ("error" in picked) return { error: picked.error };
  await tx(async (c) => {
    if (picked.slug && picked.slug !== e.slug) {
      // The old link (and printed QR codes) keep working: they redirect to the new one.
      await q(
        "update events set old_slugs = array_append(array_remove(old_slugs, $2), $3), slug = $2 where id = $1",
        [e.id, picked.slug, e.slug],
        c,
      );
      await audit(user.id, "event.link", e.id, { from: e.slug, to: picked.slug }, c);
    }
    await q(
      `update events set name = $2, description = $3, starts_at = $4, ends_at = $5, ask_guest_name = $6, uploads_enabled = $7,
         require_approval = $8, accent_color = $9, camera_only = $10, venue = $11, thank_you = $12, suggested_tags = $13, one_phone_one_roll = $14, updated_at = now() where id = $1`,
      [
        e.id,
        d.name,
        d.description,
        starts,
        ends,
        fd.get("ask_guest_name") === "on",
        // "How guests add photos": both | camera | closed.
        fd.get("photo_mode") !== "closed",
        e.cfg.features.moderation && fd.get("require_approval") === "on",
        branding && /^#[0-9a-fA-F]{6}$/.test(accent) ? accent : null,
        e.cfg.features.camera && fd.get("photo_mode") === "camera",
        d.venue,
        d.thankYou,
        d.tags,
        fd.get("one_phone_one_roll") === "on",
      ],
      c,
    );
    await refreshDeletion(e.id, c);
    await audit(user.id, "event.update", e.id, { name: d.name }, c);
  });
  revalidatePath(`/dashboard/events/${e.id}`, "layout");
  return { ok: "Saved." };
}

async function imageFromForm(fd: FormData, field: string) {
  const f = fd.get(field);
  if (!(f instanceof File) || f.size === 0) return null;
  if (f.size > 10 * 1024 * 1024) throw new InputError("Image must be under 10 MB.");
  return Buffer.from(await f.arrayBuffer());
}

export async function uploadCover(id: string, _: FormState, fd: FormData): Promise<FormState> {
  const { e } = await managed(id);
  if (e.purged_at) return { error: "This event was deleted." };
  try {
    if (fd.get("remove") === "1") {
      if (e.cover_key) await deleteObject(e.cover_key);
      await q("update events set cover_key = null, updated_at = now() where id = $1", [e.id]);
    } else {
      const buf = await imageFromForm(fd, "cover");
      if (!buf) return { error: "Choose an image." };
      const out = await sharp(buf, { limitInputPixels: 100_000_000 }).rotate().resize({ width: 1600, height: 900, fit: "cover" }).webp({ quality: 80 }).toBuffer();
      const key = `ev/${e.id}/cover.webp`;
      await putObject(key, out, "image/webp", "public, max-age=300");
      await q("update events set cover_key = $2, updated_at = now() where id = $1", [e.id, key]);
    }
  } catch (err) {
    return { error: err instanceof InputError ? err.message : "That file isn't an image we can use." };
  }
  revalidatePath(`/dashboard/events/${e.id}`, "layout");
  return { ok: "Cover updated." };
}

export async function uploadLogo(id: string, _: FormState, fd: FormData): Promise<FormState> {
  const { e } = await managed(id);
  if (!e.cfg.features.custom_branding) return { error: "Your package doesn't include custom branding." };
  try {
    if (fd.get("remove") === "1") {
      if (e.logo_key) await deleteObject(e.logo_key);
      await q("update events set logo_key = null, updated_at = now() where id = $1", [e.id]);
    } else {
      const buf = await imageFromForm(fd, "logo");
      if (!buf) return { error: "Choose an image." };
      const out = await sharp(buf, { limitInputPixels: 50_000_000 }).rotate().resize({ width: 480, height: 240, fit: "inside" }).webp({ quality: 85 }).toBuffer();
      const key = `ev/${e.id}/logo.webp`;
      await putObject(key, out, "image/webp", "public, max-age=300");
      await q("update events set logo_key = $2, updated_at = now() where id = $1", [e.id, key]);
    }
  } catch (err) {
    return { error: err instanceof InputError ? err.message : "That file isn't an image we can use." };
  }
  revalidatePath(`/dashboard/events/${e.id}`, "layout");
  return { ok: "Logo updated." };
}

export async function regenerateLink(id: string) {
  const { user, e } = await managed(id);
  const slug = await uniqueSlug();
  // A fresh private link: old links (and their redirects) stop working.
  await q("update events set slug = $2, old_slugs = '{}', updated_at = now() where id = $1", [e.id, slug]);
  await audit(user.id, "event.new_link", e.id);
  revalidatePath(`/dashboard/events/${e.id}`, "layout");
}

export async function setUploads(id: string, enabled: boolean) {
  const { e } = await managed(id);
  await q("update events set uploads_enabled = $2, updated_at = now() where id = $1", [e.id, enabled]);
  revalidatePath(`/dashboard/events/${e.id}`, "layout");
}

export async function removePhoto(id: string, photoId: string) {
  const { user, e } = await managed(id);
  if (await deletePhoto(e.id, photoId)) await audit(user.id, "photo.delete", e.id, { photo: photoId });
  revalidatePath(`/dashboard/events/${e.id}`, "layout");
}

export async function approve(id: string, photoIds: string[]) {
  const { e } = await managed(id);
  await approvePhotos(e.id, photoIds.filter((p) => /^[0-9a-f-]{36}$/.test(p)).slice(0, 500));
  revalidatePath(`/dashboard/events/${e.id}`, "layout");
}

export async function blockGuest(id: string, guestId: string, blocked: boolean) {
  const { e } = await managed(id);
  await q("update guests set is_blocked = $3 where id = $2 and event_id = $1", [e.id, guestId, blocked]);
  revalidatePath(`/dashboard/events/${e.id}`, "layout");
}

export async function removeGuestNow(id: string, guestId: string) {
  const { user, e } = await managed(id);
  if (await removeGuest(e.id, guestId)) await audit(user.id, "guest.remove", e.id, { guest: guestId });
  revalidatePath(`/dashboard/events/${e.id}`, "layout");
}

export async function mergeGuestsNow(id: string, fromId: string, intoId: string) {
  const { user, e } = await managed(id);
  if (await mergeGuests(e.id, fromId, intoId)) await audit(user.id, "guest.merge", e.id, { from: fromId, into: intoId });
  revalidatePath(`/dashboard/events/${e.id}`, "layout");
}

/** Organiser marks a flagged guest as a different person after all. */
export async function notSamePhone(id: string, guestId: string) {
  const { e } = await managed(id);
  await q("update guests set same_phone_as = null where id = $2 and event_id = $1", [e.id, guestId]);
  revalidatePath(`/dashboard/events/${e.id}`, "layout");
}

export async function deleteDraft(id: string) {
  const { user, e } = await managed(id);
  if (e.paid_at) return;
  await q("delete from events where id = $1 and paid_at is null", [e.id]);
  await audit(user.id, "event.delete_draft", e.id);
  redirect("/dashboard");
}

export async function checkout(id: string, _: FormState, fd: FormData): Promise<FormState> {
  const { user } = await managed(id);
  const kind = String(fd.get("kind")) as PurchaseKind;
  if (!["plan", "upgrade", "addon"].includes(kind)) return { error: "Choose what to buy." };
  if (!(await rateLimit("checkout", 20, 600_000, user.id))) return { error: "Too many attempts. Please wait a few minutes." };
  let url: string;
  try {
    url = await startPurchase(user, {
      eventId: id,
      kind,
      planId: String(fd.get("plan_id") ?? "") || undefined,
      addonId: String(fd.get("addon_id") ?? "") || undefined,
      promoCode: String(fd.get("promo") ?? "").trim() || undefined,
    });
  } catch (err) {
    if (err instanceof PaymentError) return { error: err.message };
    console.error("checkout failed", err);
    return { error: "We couldn't start the payment. Please try again." };
  }
  redirect(url);
}

// ------------------------------------------------------------------ missions + wishes

function cleanEmoji(raw: FormDataEntryValue | null) {
  const s = String(raw ?? "").trim();
  return s && s.length <= 16 && !/[<>]/.test(s) ? s : null;
}

export async function addMission(id: string, _: FormState, fd: FormData): Promise<FormState> {
  const { user, e } = await managed(id);
  if (!e.cfg.features.missions) return { error: "Your package doesn't include snap missions." };
  const title = String(fd.get("title") ?? "").replace(/[<>]/g, "").trim().slice(0, 80);
  if (!title) return { error: "Give the mission a name." };
  const n = await one<{ n: number; max: number }>("select count(*)::int as n, coalesce(max(sort), 0)::int as max from event_missions where event_id = $1", [e.id]);
  if ((n?.n ?? 0) >= 30) return { error: "That's plenty of missions (30 max)." };
  await q("insert into event_missions (event_id, title, emoji, sort) values ($1, $2, $3, $4)", [e.id, title, cleanEmoji(fd.get("emoji")), (n?.max ?? 0) + 1]);
  await audit(user.id, "mission.add", e.id, { title });
  revalidatePath(`/dashboard/events/${e.id}`, "layout");
  return { ok: "Mission added." };
}

/** Adds one of the ready ideas (by its index in MISSION_IDEAS), unless it's already there. */
export async function addMissionIdea(id: string, index: number) {
  const { e } = await managed(id);
  const idea = MISSION_IDEAS[index];
  if (!e.cfg.features.missions || !idea) return;
  const n = await one<{ n: number; max: number; has: boolean }>(
    "select count(*)::int as n, coalesce(max(sort), 0)::int as max, bool_or(title = $2) as has from event_missions where event_id = $1",
    [e.id, idea.title],
  );
  if (n?.has || (n?.n ?? 0) >= 30) return;
  await q("insert into event_missions (event_id, title, emoji, sort) values ($1, $2, $3, $4)", [e.id, idea.title, idea.emoji, (n?.max ?? 0) + 1]);
  revalidatePath(`/dashboard/events/${e.id}`, "layout");
}

export async function deleteMission(id: string, missionId: string) {
  const { user, e } = await managed(id);
  await q("delete from event_missions where id = $2 and event_id = $1", [e.id, missionId]);
  await audit(user.id, "mission.delete", e.id, { mission: missionId });
  revalidatePath(`/dashboard/events/${e.id}`, "layout");
}

export async function moveMission(id: string, missionId: string, dir: -1 | 1) {
  const { e } = await managed(id);
  await tx(async (c) => {
    const list = await q<{ id: string }>("select id from event_missions where event_id = $1 order by sort, created_at for update", [e.id], c);
    const i = list.findIndex((m) => m.id === missionId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    for (const [k, m] of list.entries()) await q("update event_missions set sort = $2 where id = $1", [m.id, k + 1], c);
  });
  revalidatePath(`/dashboard/events/${e.id}`, "layout");
}

export async function toggleWish(id: string, wishId: string, hidden: boolean) {
  const { user, e } = await managed(id);
  await setWishHidden(e.id, wishId, hidden);
  await audit(user.id, hidden ? "wish.hide" : "wish.show", e.id, { wish: wishId });
  revalidatePath(`/dashboard/events/${e.id}`, "layout");
}

// ------------------------------------------------------------------ delete

/**
 * Deletes the event now. Unpaid drafts disappear; paid events keep their
 * record and receipts but every photo, wish and heart is deleted for good.
 * The organiser (or an admin) must type the event name to confirm.
 */
export async function deleteEventNow(id: string, _: FormState, fd: FormData): Promise<FormState> {
  const { user, e } = await managed(id);
  const typed = String(fd.get("confirm") ?? "").trim().toLowerCase();
  if (typed !== e.name.trim().toLowerCase()) return { error: "Type the event name exactly to confirm." };
  if (!(await rateLimit("delete-event", 10, 3600_000, user.id))) return { error: "Too many attempts. Try again later." };
  if (!e.paid_at) {
    await q("delete from events where id = $1 and paid_at is null", [e.id]);
    await deletePrefixSafe(e.id);
  } else if (!e.purged_at) {
    await purgeEvent(e.id, user.id, "deleted");
  }
  await audit(user.id, "event.delete", e.id, { name: e.name, paid: !!e.paid_at });
  redirect(user.is_admin && e.owner_id !== user.id ? `/admin/events/${e.id}` : "/dashboard?deleted=1");
}

async function deletePrefixSafe(eventId: string) {
  await deletePrefix(`ev/${eventId}/`).catch(() => 0);
}
