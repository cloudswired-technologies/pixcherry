// Copy the live packages + add-ons into the LOCAL database, so local screenshots and
// demos show the real pricing. Reads production (read-only), writes only to .env.local's DB.
//   PROD_DATABASE_URL=... node scripts/sync-plans-local.mjs
import { readFileSync } from "node:fs";
import pg from "pg";

const prodUrl = process.env.PROD_DATABASE_URL;
const localUrl = readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.*)$/m)?.[1]?.trim();
if (!prodUrl || !localUrl) throw new Error("PROD_DATABASE_URL and .env.local DATABASE_URL are needed");
if (!/@(127\.0\.0\.1|localhost)[:/]/.test(localUrl)) throw new Error("refusing: .env.local DATABASE_URL is not a local database");

const prod = new pg.Client({ connectionString: prodUrl, ssl: { rejectUnauthorized: false } });
const local = new pg.Client({ connectionString: localUrl });
await prod.connect();
await local.connect();
const { rows: plans } = await prod.query("select code, name, description, price_cents, limits, features, highlights, is_active, is_featured, sort from plans");
const { rows: addons } = await prod.query("select kind, name, amount, price_cents, is_active, sort from plan_addons");
const preset = (await local.query("select id from quality_presets order by sort limit 1")).rows[0].id;
await local.query("begin");
// Old local packages that no longer exist live are switched off (events may still point at them).
await local.query("update plans set is_active = false where code <> all($1)", [plans.map((p) => p.code)]);
for (const p of plans) {
  await local.query(
    `insert into plans (code, name, description, price_cents, quality_preset_id, limits, features, highlights, is_active, is_featured, sort)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     on conflict (code) do update set name=$2, description=$3, price_cents=$4, limits=$6, features=$7, highlights=$8, is_active=$9, is_featured=$10, sort=$11`,
    [p.code, p.name, p.description, p.price_cents, preset, p.limits, p.features, p.highlights, p.is_active, p.is_featured, p.sort],
  );
}
await local.query("update plan_addons set is_active = false");
for (const a of addons) {
  const r = await local.query("update plan_addons set name=$2, amount=$3, price_cents=$4, is_active=$5, sort=$6 where kind=$1 returning id", [a.kind, a.name, a.amount, a.price_cents, a.is_active, a.sort]);
  if (!r.rowCount) await local.query("insert into plan_addons (kind, name, amount, price_cents, is_active, sort) values ($1,$2,$3,$4,$5,$6)", [a.kind, a.name, a.amount, a.price_cents, a.is_active, a.sort]);
}
await local.query("commit");
const { rows } = await local.query("select code, name, price_cents, is_active from plans order by sort");
console.log("local plans:", rows.map((r) => `${r.code}=${r.price_cents / 100}${r.is_active ? "" : " (off)"}`).join(", "));
await prod.end();
await local.end();
