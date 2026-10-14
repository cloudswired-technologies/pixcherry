import "server-only";
import { one, q, type Queryable } from "@/lib/db";

// Platform-wide settings edited from Admin → Settings.

export type Company = { name: string; address: string; email: string; reg_no: string };

export type Settings = {
  warn_days_before_delete: number;
  upload_rate_per_minute: number;
  company: Company;
};

const DEFAULTS: Settings = {
  warn_days_before_delete: 3,
  upload_rate_per_minute: 30,
  company: { name: "Cloudswired Technologies", address: "Johor, Malaysia", email: "support@pixcherry.com", reg_no: "" },
};

export async function getSettings(): Promise<Settings> {
  const rows = await q<{ key: string; value: unknown }>("select key, value from settings");
  const s = { ...DEFAULTS } as Record<string, unknown>;
  for (const r of rows) if (r.key in DEFAULTS) s[r.key] = r.value;
  return s as Settings;
}

export async function setSetting(key: keyof Settings, value: unknown, db?: Queryable) {
  await q(
    "insert into settings (key, value, updated_at) values ($1, $2, now()) on conflict (key) do update set value = excluded.value, updated_at = now()",
    [key, JSON.stringify(value)],
    db,
  );
}

export async function audit(actorId: string | null, action: string, target: string | null, details: unknown = {}, db?: Queryable) {
  await q("insert into audit_log (actor_id, action, target, details) values ($1, $2, $3, $4)", [actorId, action, target, JSON.stringify(details)], db);
}

export async function getSetting<K extends keyof Settings>(key: K): Promise<Settings[K]> {
  const r = await one<{ value: Settings[K] }>("select value from settings where key = $1", [key]);
  return r?.value ?? DEFAULTS[key];
}
