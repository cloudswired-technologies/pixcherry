// Dev helper: fetch a dashboard URL on the local server as the owner of the
// newest paid event (signed session cookie from .env.local). Saves the body.
// Usage: node scripts/dev-fetch-as.mjs "/api/events/{id}/card?inline=1" out.png
import { createHmac } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import pg from "pg";

const env = readFileSync(".env.local", "utf8");
const val = (k) => env.match(new RegExp(`^${k}=(.*)$`, "m"))?.[1]?.trim();
const secret = val("SESSION_SECRET") || "dev-only-SESSION_SECRET-not-for-production-use";
const db = new pg.Client({ connectionString: val("DATABASE_URL") });
await db.connect();
const {
  rows: [e],
} = await db.query(
  "select e.id, e.slug, u.id uid, u.session_version v from events e join users u on u.id = e.owner_id where e.paid_at is not null and e.purged_at is null order by e.created_at desc limit 1",
);
await db.end();
const p = Buffer.from(JSON.stringify({ uid: e.uid, v: e.v, exp: Date.now() + 3600_000 })).toString("base64url");
const cookie = `pc_session=${p}.${createHmac("sha256", secret).update(p).digest("base64url")}`;
const path = process.argv[2].replace("{id}", e.id).replace("{slug}", e.slug);
const r = await fetch(`http://localhost:3000${path}`, { headers: { cookie } });
const buf = Buffer.from(await r.arrayBuffer());
if (process.argv[3]) writeFileSync(process.argv[3], buf);
console.log(r.status, r.headers.get("content-type"), buf.length, "bytes", path);
