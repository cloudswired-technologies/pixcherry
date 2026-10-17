import "server-only";
import { one, q, type Queryable } from "@/lib/db";
import { randomSlug } from "@/lib/crypto";
import { GUEST_HOST, GUEST_URL } from "@/lib/env";
import { SLUG_RE, slugProblem, slugify } from "@/lib/slug";
import { type EventConfig, type Overrides, type PlanSnapshot, deletionDate, eventConfig } from "@/lib/limits";
import type { AddonKind } from "@/lib/plan-schema";
import { publicUrl } from "@/lib/storage";

export type EventRow = {
  id: string;
  owner_id: string;
  slug: string;
  old_slugs: string[];
  name: string;
  description: string;
  venue: string;
  thank_you: string;
  suggested_tags: string[];
  starts_at: Date;
  ends_at: Date;
  cover_key: string | null;
  accent_color: string | null;
  logo_key: string | null;
  ask_guest_name: boolean;
  uploads_enabled: boolean;
  require_approval: boolean;
  camera_only: boolean;
  one_phone_one_roll: boolean;
  plan_id: string | null;
  plan_snapshot: PlanSnapshot | null;
  addon_totals: Partial<Record<AddonKind, number>>;
  overrides: Overrides;
  paid_at: Date | null;
  deletion_at: Date | null;
  warned_at: Date | null;
  purged_at: Date | null;
  photo_count: number;
  guest_count: number;
  bytes_used: string; // bigint
  is_demo: boolean;
  demo_key: string | null;
  created_at: Date;
  updated_at: Date;
};

export type EventWithConfig = EventRow & { cfg: EventConfig };

function withCfg(e: EventRow): EventWithConfig {
  return { ...e, cfg: eventConfig(e) };
}

export async function getEventBySlug(slug: string) {
  if (!SLUG_RE.test(slug)) return null;
  const e = await one<EventRow>("select * from events where slug = $1", [slug]);
  return e ? withCfg(e) : null;
}

/** Current slug of an event that used to live at `slug` (renamed link), if any. */
export async function renamedSlug(slug: string) {
  if (!SLUG_RE.test(slug)) return null;
  return (await one<{ slug: string }>("select slug from events where $1 = any(old_slugs) order by updated_at desc limit 1", [slug]))?.slug ?? null;
}

/** A link nobody else uses now or used before (old links still redirect). */
export async function slugTaken(slug: string, exceptEventId?: string, db?: Queryable) {
  return !!(await one(
    "select 1 from events where (slug = $1 or $1 = any(old_slugs)) and id <> coalesce($2::uuid, '00000000-0000-0000-0000-000000000000')",
    [slug, exceptEventId ?? null],
    db,
  ));
}

export async function getEventById(id: string, db?: Queryable) {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const e = await one<EventRow>("select * from events where id = $1", [id], db);
  return e ? withCfg(e) : null;
}

/** Event the user may manage (owner, or platform admin). */
export async function getManagedEvent(id: string, user: { id: string; is_admin: boolean }) {
  const e = await getEventById(id);
  if (!e || (e.owner_id !== user.id && !user.is_admin)) return null;
  return e;
}

export async function listOwnerEvents(ownerId: string) {
  return (await q<EventRow>("select * from events where owner_id = $1 order by starts_at desc", [ownerId])).map(withCfg);
}

/** Free slug from the event name ("aina-hakim", "aina-hakim-2", …), else a random one. */
export async function slugFromName(name: string, db?: Queryable) {
  const base = slugify(name).slice(0, 34).replace(/-+$/g, "");
  if (base && !slugProblem(base)) {
    for (let i = 1; i <= 20; i++) {
      const s = i === 1 ? base : `${base}-${i}`;
      if (!(await slugTaken(s, undefined, db))) return s;
    }
  }
  return uniqueSlug(db);
}

export async function uniqueSlug(db?: Queryable) {
  for (let i = 0; i < 5; i++) {
    const s = randomSlug();
    if (!(await one("select 1 from events where slug = $1", [s], db))) return s;
  }
  throw new Error("could not allocate slug");
}

/** Re-computes deletion_at from dates + effective limits. Call after anything that changes them. */
export async function refreshDeletion(eventId: string, db: Queryable) {
  const e = await getEventById(eventId, db);
  // Demo albums never expire (lib/demo.ts clears what visitors add instead).
  if (!e || !e.paid_at || e.purged_at || e.is_demo) return;
  const at =deletionDate(new Date(e.ends_at), e.cfg);
  // Moving the date later re-arms the warning email.
  await q(
    "update events set deletion_at = $2, warned_at = case when $2 > coalesce(deletion_at, $2) then null else warned_at end, updated_at = now() where id = $1",
    [eventId, at],
    db,
  );
}

/** The link guests open (QR code): app.pixcherry.com/<slug> in production. */
export function guestUrl(slug: string) {
  return `${GUEST_URL}/${slug}`;
}

/** Same page as a path on the guest host (links inside the guest app). */
export function guestPath(slug: string) {
  return GUEST_HOST ? `/${slug}` : `/e/${slug}`;
}

export function coverUrl(e: Pick<EventRow, "cover_key" | "updated_at">) {
  return e.cover_key ? publicUrl(e.cover_key, new Date(e.updated_at).getTime()) : null;
}

export function logoUrl(e: Pick<EventRow, "logo_key" | "updated_at">) {
  return e.logo_key ? publicUrl(e.logo_key, new Date(e.updated_at).getTime()) : null;
}
