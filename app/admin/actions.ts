"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { one, q, tx } from "@/lib/db";
import { getEventById, refreshDeletion } from "@/lib/events";
import type { Overrides } from "@/lib/limits";
import { applyPaid } from "@/lib/payments";
import { ADDON_KINDS, FEATURES, LIMITS } from "@/lib/plan-schema";
import { audit, setSetting } from "@/lib/settings";

export type AdminState = { error?: string; ok?: string };

const money = (v: FormDataEntryValue | null) => {
  const n = Number(String(v ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
};
const int = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isInteger(n) ? n : NaN;
};
const uuid = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "");
  return /^[0-9a-f-]{36}$/.test(s) ? s : null;
};

// ------------------------------------------------------------------ plans

export async function savePlan(id: string | null, _: AdminState, fd: FormData): Promise<AdminState> {
  const admin = await requireAdmin();
  const code = String(fd.get("code") ?? "").trim().toLowerCase();
  const name = String(fd.get("name") ?? "").trim().slice(0, 60);
  const price = money(fd.get("price"));
  const preset = uuid(fd.get("quality_preset_id"));
  if (!/^[a-z0-9-]{2,40}$/.test(code)) return { error: "Code: 2–40 lowercase letters, numbers or dashes." };
  if (!name) return { error: "Name is required." };
  if (price === null) return { error: "Enter a valid price." };
  if (!preset) return { error: "Choose a photo quality." };
  const limits: Record<string, number> = {};
  for (const l of LIMITS) {
    const n = int(fd.get(`limit_${l.key}`));
    if (n === null || Number.isNaN(n) || n < l.min || n > l.max) return { error: `${l.label}: enter a whole number from ${l.min} to ${l.max}.` };
    limits[l.key] = n;
  }
  const features: Record<string, boolean> = {};
  for (const f of FEATURES) features[f.key] = fd.get(`feature_${f.key}`) === "on";
  const highlights = String(fd.get("highlights") ?? "").split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 10);
  const values = [
    code,
    name,
    String(fd.get("description") ?? "").trim().slice(0, 300),
    price,
    preset,
    JSON.stringify(limits),
    JSON.stringify(features),
    highlights,
    fd.get("is_active") === "on",
    fd.get("is_featured") === "on",
    int(fd.get("sort")) || 0,
  ];
  try {
    if (id) {
      await q(
        `update plans set code=$2, name=$3, description=$4, price_cents=$5, quality_preset_id=$6, limits=$7, features=$8, highlights=$9,
           is_active=$10, is_featured=$11, sort=$12, updated_at=now() where id=$1`,
        [id, ...values],
      );
    } else {
      const r = await one<{ id: string }>(
        `insert into plans (code, name, description, price_cents, quality_preset_id, limits, features, highlights, is_active, is_featured, sort)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning id`,
        values,
      );
      id = r!.id;
    }
  } catch (e) {
    if ((e as { code?: string }).code === "23505") return { error: "Another package already uses that code." };
    throw e;
  }
  await audit(admin.id, "plan.save", id, { code, price_cents: price, limits, features });
  revalidatePath("/admin/plans");
  revalidatePath("/");
  redirect(`/admin/plans/${id}?saved=1`);
}

// ------------------------------------------------------------------ quality presets

export async function savePreset(id: string | null, _: AdminState, fd: FormData): Promise<AdminState> {
  const admin = await requireAdmin();
  const name = String(fd.get("name") ?? "").trim().slice(0, 60);
  const maxPx = int(fd.get("max_px"));
  const quality = int(fd.get("jpeg_quality"));
  if (!name) return { error: "Name is required." };
  if (maxPx !== null && (Number.isNaN(maxPx) || maxPx < 640 || maxPx > 12000)) return { error: "Max size: 640–12000 px, or empty for original." };
  if (quality === null || Number.isNaN(quality) || quality < 50 || quality > 100) return { error: "JPEG quality: 50–100." };
  const sort = int(fd.get("sort")) || 0;
  if (id) await q("update quality_presets set name=$2, max_px=$3, jpeg_quality=$4, sort=$5 where id=$1", [id, name, maxPx, quality, sort]);
  else await q("insert into quality_presets (name, max_px, jpeg_quality, sort) values ($1,$2,$3,$4)", [name, maxPx, quality, sort]);
  await audit(admin.id, "preset.save", id, { name, max_px: maxPx, jpeg_quality: quality });
  revalidatePath("/admin/quality");
  return { ok: "Saved. Packages using this preset apply it to events paid from now on." };
}

export async function deletePreset(id: string) {
  const admin = await requireAdmin();
  const used = await one("select 1 from plans where quality_preset_id = $1 limit 1", [id]);
  if (used) return;
  await q("delete from quality_presets where id = $1", [id]);
  await audit(admin.id, "preset.delete", id);
  revalidatePath("/admin/quality");
}

// ------------------------------------------------------------------ add-ons

export async function saveAddon(id: string | null, _: AdminState, fd: FormData): Promise<AdminState> {
  const admin = await requireAdmin();
  const kind = String(fd.get("kind"));
  const name = String(fd.get("name") ?? "").trim().slice(0, 80);
  const amount = int(fd.get("amount"));
  const price = money(fd.get("price"));
  if (!ADDON_KINDS.some((k) => k.kind === kind)) return { error: "Choose what the add-on gives." };
  if (!name) return { error: "Name is required." };
  if (!amount || Number.isNaN(amount) || amount < 1) return { error: "Amount must be a whole number above 0." };
  if (price === null) return { error: "Enter a valid price." };
  const vals = [kind, name, amount, price, fd.get("is_active") === "on", int(fd.get("sort")) || 0];
  if (id) await q("update plan_addons set kind=$2, name=$3, amount=$4, price_cents=$5, is_active=$6, sort=$7 where id=$1", [id, ...vals]);
  else await q("insert into plan_addons (kind, name, amount, price_cents, is_active, sort) values ($1,$2,$3,$4,$5,$6)", vals);
  await audit(admin.id, "addon.save", id, { kind, amount, price_cents: price });
  revalidatePath("/admin/addons");
  return { ok: "Saved." };
}

// ------------------------------------------------------------------ promo codes

export async function savePromo(_: AdminState, fd: FormData): Promise<AdminState> {
  const admin = await requireAdmin();
  const code = String(fd.get("code") ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,30}$/.test(code)) return { error: "Code: 3–30 letters, numbers, dash or underscore." };
  const type = String(fd.get("type"));
  const value = Number(fd.get("value"));
  const percent = type === "percent" ? Math.round(value) : null;
  const amount = type === "amount" ? money(fd.get("value")) : null;
  if (type === "percent" && (!percent || percent < 1 || percent > 100)) return { error: "Percent must be 1–100." };
  if (type === "amount" && !amount) return { error: "Enter a discount amount." };
  const maxUses = int(fd.get("max_uses"));
  const expires = String(fd.get("expires") ?? "");
  try {
    await q(
      "insert into promo_codes (code, percent_off, amount_off_cents, plan_id, max_uses, expires_at) values ($1,$2,$3,$4,$5,$6)",
      [code, percent, amount, uuid(fd.get("plan_id")), maxUses && !Number.isNaN(maxUses) ? maxUses : null, expires ? new Date(`${expires}T23:59:59+08:00`) : null],
    );
  } catch (e) {
    if ((e as { code?: string }).code === "23505") return { error: "That code already exists." };
    throw e;
  }
  await audit(admin.id, "promo.create", code);
  revalidatePath("/admin/promos");
  return { ok: `Code ${code} created.` };
}

export async function togglePromo(id: string, active: boolean) {
  const admin = await requireAdmin();
  await q("update promo_codes set is_active = $2 where id = $1", [id, active]);
  await audit(admin.id, active ? "promo.enable" : "promo.disable", id);
  revalidatePath("/admin/promos");
}

// ------------------------------------------------------------------ events

export async function saveOverrides(eventId: string, _: AdminState, fd: FormData): Promise<AdminState> {
  const admin = await requireAdmin();
  const e = await getEventById(eventId);
  if (!e) return { error: "Event not found." };
  const ov: Overrides = { limits: {}, features: {} };
  for (const l of LIMITS) {
    const n = int(fd.get(`limit_${l.key}`));
    if (n === null) continue;
    if (Number.isNaN(n) || n < l.min) return { error: `${l.label}: whole number, at least ${l.min}.` };
    ov.limits![l.key] = n;
  }
  for (const f of FEATURES) {
    const v = String(fd.get(`feature_${f.key}`) ?? "");
    if (v === "on") ov.features![f.key] = true;
    if (v === "off") ov.features![f.key] = false;
  }
  const presetId = uuid(fd.get("quality_preset_id"));
  if (presetId) {
    const p = await one<{ name: string; max_px: number | null; jpeg_quality: number }>("select name, max_px, jpeg_quality from quality_presets where id = $1", [presetId]);
    if (p) ov.quality = p;
  }
  const note = String(fd.get("note") ?? "").trim().slice(0, 500);
  if (note) ov.note = note;
  await tx(async (c) => {
    await q("update events set overrides = $2, updated_at = now() where id = $1", [eventId, JSON.stringify(ov)], c);
    await refreshDeletion(eventId, c);
    await audit(admin.id, "event.overrides", eventId, ov, c);
  });
  revalidatePath(`/admin/events/${eventId}`);
  return { ok: "Overrides saved. Deletion date recalculated." };
}

export async function activateEvent(eventId: string, _: AdminState, fd: FormData): Promise<AdminState> {
  const admin = await requireAdmin();
  const e = await getEventById(eventId);
  const planId = uuid(fd.get("plan_id"));
  if (!e || e.paid_at) return { error: "Event is already active." };
  if (!planId) return { error: "Choose a package." };
  const plan = await one<{ name: string }>("select name from plans where id = $1", [planId]);
  if (!plan) return { error: "Package not found." };
  const p = await one<{ id: string }>(
    `insert into purchases (event_id, user_id, kind, plan_id, description, subtotal_cents, discount_cents, amount_cents)
     values ($1, $2, 'plan', $3, $4, 0, 0, 0) returning id`,
    [e.id, e.owner_id, planId, `${plan.name} package (activated by admin)`],
  );
  await applyPaid(p!.id, null);
  await audit(admin.id, "event.activate", eventId, { plan: planId });
  revalidatePath(`/admin/events/${eventId}`);
  return { ok: "Event activated." };
}

// ------------------------------------------------------------------ settings

export async function saveSettings(_: AdminState, fd: FormData): Promise<AdminState> {
  const admin = await requireAdmin();
  const warn = int(fd.get("warn_days_before_delete"));
  const rate = int(fd.get("upload_rate_per_minute"));
  if (!warn || Number.isNaN(warn) || warn < 1 || warn > 60) return { error: "Warning days: 1–60." };
  if (!rate || Number.isNaN(rate) || rate < 1 || rate > 1000) return { error: "Upload rate: 1–1000 per minute." };
  const company = {
    name: String(fd.get("company_name") ?? "").trim().slice(0, 120),
    reg_no: String(fd.get("company_reg_no") ?? "").trim().slice(0, 60),
    address: String(fd.get("company_address") ?? "").trim().slice(0, 300),
    email: String(fd.get("company_email") ?? "").trim().slice(0, 120),
  };
  await tx(async (c) => {
    await setSetting("warn_days_before_delete", warn, c);
    await setSetting("upload_rate_per_minute", rate, c);
    await setSetting("company", company, c);
    await audit(admin.id, "settings.save", null, { warn, rate, company }, c);
  });
  revalidatePath("/admin/settings");
  return { ok: "Settings saved." };
}
