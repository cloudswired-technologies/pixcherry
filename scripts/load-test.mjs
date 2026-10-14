// Upload load test against a running app + worker (local or staging).
//   node scripts/load-test.mjs [events=20] [guests=10] [photos=5] [concurrency=30]
// Creates paid test events and guests straight in the DB, then every guest
// uploads through the real API (reserve → PUT → done). Reports API latency and
// how fast the worker turns uploads into ready photos. Test rows are removed at the end.
import { createHash, createHmac, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import pg from "pg";
import sharp from "sharp";

for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const [EVENTS = 20, GUESTS = 10, PHOTOS = 5, CONC = 30] = process.argv.slice(2).map(Number);
const BASE = process.env.APP_URL ?? "http://localhost:3000";
const SECRET = process.env.SESSION_SECRET ?? "dev-only-SESSION_SECRET-not-for-production-use";
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 4 });

const sign = (obj) => {
  const p = Buffer.from(JSON.stringify(obj)).toString("base64url");
  return `${p}.${createHmac("sha256", SECRET).update(p).digest("base64url")}`;
};

// A realistic phone-resized photo: 2048x1536 with noise (compresses like a real scene).
const raw = randomBytes(2048 * 1536 * 3);
for (let i = 0; i < raw.length; i++) raw[i] = 90 + (raw[i] % 80);
const photo = await sharp(raw, { raw: { width: 2048, height: 1536, channels: 3 } }).blur(1.2).jpeg({ quality: 80 }).toBuffer();
console.log(`photo size ${(photo.length / 1024).toFixed(0)} KB, ${EVENTS} events x ${GUESTS} guests x ${PHOTOS} photos = ${EVENTS * GUESTS * PHOTOS} uploads, concurrency ${CONC}`);

const { rows: [plan] } = await db.query(
  "select p.id, p.limits, p.features, json_build_object('name', q.name, 'max_px', q.max_px, 'jpeg_quality', q.jpeg_quality) as quality from plans p join quality_presets q on q.id = p.quality_preset_id where code = 'basic'",
);
const { rows: [user] } = await db.query("insert into users (email) values ($1) returning id", [`load-${Date.now()}@example.com`]);
const guests = [];
const eventIds = [];
for (let e = 0; e < EVENTS; e++) {
  const slug = randomBytes(8).toString("hex").replace(/[^a-z0-9]/g, "").slice(0, 10).padEnd(10, "a");
  const snap = { plan_id: plan.id, code: "basic", name: "Basic", price_cents: 5000, quality: plan.quality, limits: plan.limits, features: plan.features };
  const { rows: [ev] } = await db.query(
    `insert into events (owner_id, slug, name, starts_at, ends_at, plan_id, plan_snapshot, paid_at, deletion_at)
     values ($1, $2, 'Load test', now(), now() + interval '5 hours', $3, $4, now(), now() + interval '8 days') returning id`,
    [user.id, slug, plan.id, JSON.stringify(snap)],
  );
  eventIds.push(ev.id);
  for (let g = 0; g < GUESTS; g++) {
    const t = randomBytes(16).toString("base64url");
    const { rows: [row] } = await db.query("insert into guests (event_id, name, token_hash) values ($1, $2, $3) returning id", [
      ev.id, `Guest ${g}`, createHash("sha256").update(t).digest("hex"),
    ]);
    guests.push({ slug, cookie: `pcg_${ev.id.slice(0, 8)}=${sign({ g: row.id, e: ev.id, t })}` });
  }
}

const jobs = guests.flatMap((g) => Array.from({ length: PHOTOS }, () => g));
const lat = { reserve: [], put: [], done: [] };
let failed = 0;
const timed = async (bucket, fn) => {
  const t = performance.now();
  const r = await fn();
  lat[bucket].push(performance.now() - t);
  return r;
};

const t0 = performance.now();
let next = 0;
await Promise.all(
  Array.from({ length: CONC }, async () => {
    while (next < jobs.length) {
      const g = jobs[next++];
      try {
        const r = await timed("reserve", () =>
          fetch(`${BASE}/api/e/${g.slug}/uploads`, { method: "POST", headers: { "content-type": "application/json", cookie: g.cookie }, body: JSON.stringify({ files: [{ type: "image/jpeg", size: photo.length }] }) }),
        );
        if (!r.ok) throw new Error(`reserve ${r.status} ${await r.text()}`);
        const { uploads } = await r.json();
        const p = await timed("put", () => fetch(uploads[0].url, { method: "PUT", headers: { "content-type": "image/jpeg" }, body: photo }));
        if (!p.ok) throw new Error(`put ${p.status}`);
        const d = await timed("done", () => fetch(`${BASE}/api/e/${g.slug}/uploads/${uploads[0].id}`, { method: "POST", headers: { cookie: g.cookie } }));
        if (!d.ok) throw new Error(`done ${d.status}`);
      } catch (e) {
        failed++;
        if (failed <= 5) console.error(e.message);
      }
    }
  }),
);
const uploadSecs = (performance.now() - t0) / 1000;

// Wait for the worker to drain.
let ready = 0;
for (;;) {
  const { rows: [c] } = await db.query(
    "select count(*) filter (where status in ('ready','review'))::int as ready, count(*) filter (where status in ('uploaded','processing'))::int as left from photos where event_id = any($1)",
    [eventIds],
  );
  ready = c.ready;
  if (c.left === 0) break;
  await new Promise((r) => setTimeout(r, 500));
}
const totalSecs = (performance.now() - t0) / 1000;

const pct = (a, p) => (a.length ? a.sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * p))].toFixed(0) : "-");
console.log(`uploads finished in ${uploadSecs.toFixed(1)}s (${(jobs.length / uploadSecs).toFixed(1)}/s), failed ${failed}`);
for (const k of Object.keys(lat)) console.log(`  ${k.padEnd(8)} p50 ${pct(lat[k], 0.5)}ms  p95 ${pct(lat[k], 0.95)}ms`);
console.log(`all ${ready} photos ready after ${totalSecs.toFixed(1)}s → worker ≈ ${(ready / totalSecs).toFixed(1)} photos/s overall`);

// Clean up test data (storage files are removed by deleting the event prefix via cron logic; here we just mark for purge).
await db.query("update events set deletion_at = now() - interval '1 minute' where id = any($1)", [eventIds]);
console.log("test events marked for deletion; run the hourly cron to remove their files");
await db.end();
