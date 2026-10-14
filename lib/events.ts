import "server-only";
import { one, q, type Queryable } from "@/lib/db";
import { randomSlug } from "@/lib/crypto";
import { type EventConfig, type Overrides, type PlanSnapshot, deletionDate, eventConfig } from "@/lib/limits";
import type { AddonKind } from "@/lib/plan-schema";
import { publicUrl } from "@/lib/storage";

export type EventRow = {
  id: string;
  owner_id: string;
  slug: string;
  name: string;
  description: string;
  starts_at: Date;
  ends_at: Date;
  cover_key: string | null;
  accent_color: string | null;
  logo_key: string | null;
  ask_guest_name: boolean;
  uploads_enabled: boolean;
  require_approval: boolean;
  camera_only: boolean;
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
  created_at: Date;
  updated_at: Date;
};

export type EventWithConfig = EventRow & { cfg: EventConfig };

function withCfg(e: EventRow): EventWithConfig {
  return { ...e, cfg: eventConfig(e) };
}

export async function getEventBySlug(slug: string) {
  if (!/^[a-z0-9]{8,32}$/.test(slug)) return null;
  const e = await one<EventRow>("select * from events where slug = $1", [slug]);
  return e ? withCfg(e) : null;
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
  if (!e || !e.paid_at || e.purged_at) return;
  const at = deletionDate(new Date(e.ends_at), e.cfg);
  // Moving the date later re-arms the warning email.
  await q(
    "update events set deletion_at = $2, warned_at = case when $2 > coalesce(deletion_at, $2) then null else warned_at end, updated_at = now() where id = $1",
    [eventId, at],
    db,
  );
}

export function guestUrl(appUrl: string, slug: string) {
  return `${appUrl}/e/${slug}`;
}

export function coverUrl(e: Pick<EventRow, "cover_key" | "updated_at">) {
  return e.cover_key ? publicUrl(e.cover_key, new Date(e.updated_at).getTime()) : null;
}

export function logoUrl(e: Pick<EventRow, "logo_key" | "updated_at">) {
  return e.logo_key ? publicUrl(e.logo_key, new Date(e.updated_at).getTime()) : null;
}
