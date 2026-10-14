"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import sharp from "sharp";
import { requireUser } from "@/lib/auth";
import { one, q, tx } from "@/lib/db";
import { getManagedEvent, refreshDeletion, uniqueSlug } from "@/lib/events";
import { parseLocalDateTime } from "@/lib/format";
import { approvePhotos, deletePhoto } from "@/lib/photos";
import { PaymentError, startPurchase, type PurchaseKind } from "@/lib/payments";
import { rateLimit } from "@/lib/rate-limit";
import { audit } from "@/lib/settings";
import { deleteObject, putObject } from "@/lib/storage";

export type FormState = { error?: string; ok?: string };

class InputError extends Error {}

async function managed(id: string) {
  const user = await requireUser();
  const e = await getManagedEvent(id, user);
  if (!e) redirect("/dashboard");
  return { user, e };
}

function readDetails(fd: FormData) {
  const name = String(fd.get("name") ?? "").trim().slice(0, 120);
  const description = String(fd.get("description") ?? "").trim().slice(0, 2000);
  const starts = parseLocalDateTime(String(fd.get("starts_at") ?? ""));
  const ends = parseLocalDateTime(String(fd.get("ends_at") ?? ""));
  if (!name) return { error: "Give your event a name." } as const;
  if (!starts || !ends) return { error: "Enter when the event starts and ends." } as const;
  if (ends < starts) return { error: "The end must be after the start." } as const;
  if (ends.getTime() - starts.getTime() > 14 * 86400_000) return { error: "An event can last at most 14 days." } as const;
  return { name, description, starts, ends } as const;
}

export async function createEvent(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!(await rateLimit("create-event", 20, 3600_000, user.id))) return { error: "Too many events created. Try again later." };
  const d = readDetails(fd);
  if ("error" in d) return { error: d.error };
  if (d.ends.getTime() < Date.now() - 86400_000) return { error: "That date has already passed." };
  const slug = await uniqueSlug();
  const row = await one<{ id: string }>(
    "insert into events (owner_id, slug, name, description, starts_at, ends_at) values ($1,$2,$3,$4,$5,$6) returning id",
    [user.id, slug, d.name, d.description, d.starts, d.ends],
  );
  const plan = String(fd.get("plan") ?? "");
  redirect(`/dashboard/events/${row!.id}/checkout${/^[a-z0-9-]{2,40}$/.test(plan) ? `?plan=${plan}` : ""}`);
}

export async function updateEvent(id: string, _: FormState, fd: FormData): Promise<FormState> {
  const { user, e } = await managed(id);
  if (e.purged_at) return { error: "This event's photos were deleted; it can't be changed." };
  const d = readDetails(fd);
  if ("error" in d) return { error: d.error };
  const branding = e.cfg.features.custom_branding;
  const accent = String(fd.get("accent_color") ?? "");
  await tx(async (c) => {
    await q(
      `update events set name = $2, description = $3, starts_at = $4, ends_at = $5, ask_guest_name = $6, uploads_enabled = $7,
         require_approval = $8, accent_color = $9, updated_at = now() where id = $1`,
      [
        e.id,
        d.name,
        d.description,
        d.starts,
        d.ends,
        fd.get("ask_guest_name") === "on",
        fd.get("uploads_enabled") === "on",
        e.cfg.features.moderation && fd.get("require_approval") === "on",
        branding && /^#[0-9a-fA-F]{6}$/.test(accent) ? accent : null,
      ],
      c,
    );
    await refreshDeletion(e.id, c);
    await audit(user.id, "event.update", e.id, { name: d.name }, c);
  });
  revalidatePath(`/dashboard/events/${e.id}`);
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
  revalidatePath(`/dashboard/events/${e.id}`);
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
  revalidatePath(`/dashboard/events/${e.id}`);
  return { ok: "Logo updated." };
}

export async function regenerateLink(id: string) {
  const { user, e } = await managed(id);
  const slug = await uniqueSlug();
  await q("update events set slug = $2, updated_at = now() where id = $1", [e.id, slug]);
  await audit(user.id, "event.new_link", e.id);
  revalidatePath(`/dashboard/events/${e.id}`);
}

export async function setUploads(id: string, enabled: boolean) {
  const { e } = await managed(id);
  await q("update events set uploads_enabled = $2, updated_at = now() where id = $1", [e.id, enabled]);
  revalidatePath(`/dashboard/events/${e.id}`);
}

export async function removePhoto(id: string, photoId: string) {
  const { user, e } = await managed(id);
  if (await deletePhoto(e.id, photoId)) await audit(user.id, "photo.delete", e.id, { photo: photoId });
  revalidatePath(`/dashboard/events/${e.id}/photos`);
}

export async function approve(id: string, photoIds: string[]) {
  const { e } = await managed(id);
  await approvePhotos(e.id, photoIds.filter((p) => /^[0-9a-f-]{36}$/.test(p)).slice(0, 500));
  revalidatePath(`/dashboard/events/${e.id}/photos`);
}

export async function blockGuest(id: string, guestId: string, blocked: boolean) {
  const { e } = await managed(id);
  await q("update guests set is_blocked = $3 where id = $2 and event_id = $1", [e.id, guestId, blocked]);
  revalidatePath(`/dashboard/events/${e.id}/photos`);
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
