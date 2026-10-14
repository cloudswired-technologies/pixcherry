import "server-only";
import { one, q, type Queryable } from "@/lib/db";
import type { PlanSnapshot } from "@/lib/limits";
import { type Features, type Limits, type QualityPreset, normaliseFeatures, normaliseLimits } from "@/lib/plan-schema";
import type { AddonKind } from "@/lib/plan-schema";

export type Plan = {
  id: string;
  code: string;
  name: string;
  description: string;
  price_cents: number;
  quality_preset_id: string;
  quality: QualityPreset;
  limits: Limits;
  features: Features;
  highlights: string[];
  is_active: boolean;
  is_featured: boolean;
  sort: number;
};

export type Addon = { id: string; kind: AddonKind; name: string; amount: number; price_cents: number; is_active: boolean; sort: number };

export type Preset = QualityPreset & { id: string; sort: number };

const PLAN_SQL = `select p.*, json_build_object('name', qp.name, 'max_px', qp.max_px, 'jpeg_quality', qp.jpeg_quality) as quality
  from plans p join quality_presets qp on qp.id = p.quality_preset_id`;

function shape(r: Plan): Plan {
  return { ...r, limits: normaliseLimits(r.limits), features: normaliseFeatures(r.features) };
}

export async function listPlans(activeOnly = true) {
  return (await q<Plan>(`${PLAN_SQL} ${activeOnly ? "where p.is_active" : ""} order by p.sort, p.price_cents`)).map(shape);
}

export async function getPlan(id: string, db?: Queryable) {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const r = await one<Plan>(`${PLAN_SQL} where p.id = $1`, [id], db);
  return r ? shape(r) : null;
}

export function snapshot(p: Plan): PlanSnapshot {
  return { plan_id: p.id, code: p.code, name: p.name, price_cents: p.price_cents, quality: p.quality, limits: p.limits, features: p.features };
}

export async function listAddons(activeOnly = true) {
  return q<Addon>(`select * from plan_addons ${activeOnly ? "where is_active" : ""} order by sort, price_cents`);
}

export async function listPresets() {
  return q<Preset>("select id, name, max_px, jpeg_quality, sort from quality_presets order by sort, name");
}
