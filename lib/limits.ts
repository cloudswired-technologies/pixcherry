import {
  type AddonKind,
  type Features,
  type Limits,
  type QualityPreset,
  LIMITS,
  normaliseFeatures,
  normaliseLimits,
} from "@/lib/plan-schema";

// The single place that decides what an event is allowed to do:
// plan snapshot (as paid) + paid add-ons, then admin overrides win.

export type PlanSnapshot = {
  plan_id: string;
  code: string;
  name: string;
  price_cents: number;
  quality: QualityPreset;
  limits: Partial<Limits>;
  features: Partial<Features>;
};

export type Overrides = {
  limits?: Partial<Limits>;
  features?: Partial<Features>;
  quality?: QualityPreset;
  note?: string;
};

export type EventConfigInput = {
  plan_snapshot: PlanSnapshot | null;
  addon_totals: Partial<Record<AddonKind, number>> | null;
  overrides: Overrides | null;
};

export type EventConfig = { limits: Limits; features: Features; quality: QualityPreset };

const DEFAULT_QUALITY: QualityPreset = { name: "Standard", max_px: 2048, jpeg_quality: 80 };

export function eventConfig(e: EventConfigInput): EventConfig {
  const snap = e.plan_snapshot;
  const base = normaliseLimits(snap?.limits);
  const addons = e.addon_totals ?? {};
  const ov = e.overrides ?? {};
  const merged: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(addons)) {
    if (k in merged && Number.isFinite(Number(v))) merged[k] = Number(merged[k]) + Number(v);
  }
  for (const [k, v] of Object.entries(ov.limits ?? {})) {
    if (v !== null && v !== undefined && Number.isFinite(Number(v))) merged[k] = Number(v);
  }
  // Add-ons may push past the registry max on purpose; only clamp the floor.
  const limits = {} as Limits;
  for (const l of LIMITS) limits[l.key] = Math.max(l.min, Math.round(Number(merged[l.key])));
  // The whole album holds every guest's full roll (plus any old "+photos" add-on),
  // unless an admin set a number for this event.
  if (ov.limits?.max_photos === undefined || ov.limits?.max_photos === null) {
    limits.max_photos = limits.max_guests * limits.photos_per_guest + Number((addons as Record<string, number>).max_photos ?? 0);
  }
  const features = normaliseFeatures({ ...normaliseFeatures(snap?.features), ...(ov.features ?? {}) });
  const quality = ov.quality ?? snap?.quality ?? DEFAULT_QUALITY;
  return { limits, features, quality };
}

const HOUR = 3600_000;
const DAY = 24 * HOUR;

export function deletionDate(endsAt: Date, cfg: EventConfig) {
  return new Date(endsAt.getTime() + cfg.limits.retention_days * DAY);
}

export function uploadsCloseAt(endsAt: Date, cfg: EventConfig) {
  return new Date(endsAt.getTime() + cfg.limits.upload_hours_after_event * HOUR);
}

export type EventPhase = "draft" | "upcoming" | "live" | "ended" | "deleted";

export function eventPhase(
  e: { paid_at: Date | null; purged_at: Date | null; starts_at: Date; ends_at: Date },
  now = new Date(),
): EventPhase {
  if (e.purged_at) return "deleted";
  if (!e.paid_at) return "draft";
  if (now < e.starts_at) return "upcoming";
  if (now <= e.ends_at) return "live";
  return "ended";
}

/** The album opens to guests at the event's start time (before that: a "opens on…" page). */
export function albumOpen(e: { starts_at: Date }, now = new Date()) {
  return now >= new Date(e.starts_at);
}

/**
 * Guests can join and add photos from the start of the event until the package's
 * upload window after it ends. Everything else (dates, retention) follows the same dates.
 */
export function uploadsOpen(
  e: { paid_at: Date | null; purged_at: Date | null; starts_at: Date; ends_at: Date; deletion_at: Date | null; uploads_enabled: boolean },
  cfg: EventConfig,
  now = new Date(),
) {
  if (!e.paid_at || e.purged_at || !e.uploads_enabled) return false;
  if (!albumOpen(e, now)) return false;
  if (e.deletion_at && now >= e.deletion_at) return false;
  return now <= uploadsCloseAt(e.ends_at, cfg);
}

/** Dates are fixed once the event has started (so one payment covers one event, and retention can't be stretched). */
export function datesLocked(e: { paid_at: Date | null; starts_at: Date }, now = new Date()) {
  return !!e.paid_at && now >= new Date(e.starts_at);
}

/** True when the photos will be deleted within `warnDays`. */
export function deletionSoon(e: { deletion_at: Date | null; purged_at: Date | null }, warnDays: number, now = Date.now()) {
  return !!e.deletion_at && !e.purged_at && e.deletion_at.getTime() - now < warnDays * DAY;
}
