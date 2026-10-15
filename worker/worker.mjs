// PixCherry image worker. Runs as its own process (systemd `pixcherry-worker`).
// Claims uploaded photos from the `photos` table (FOR UPDATE SKIP LOCKED),
// checks and re-encodes them with sharp, writes full/md/sm to storage and
// marks them ready. Several workers can run side by side safely.
//
//   node worker/worker.mjs          (reads .env.local when present)
//   WORKER_CONCURRENCY=2            parallel photos per process
import { readFileSync, existsSync } from "node:fs";
import pg from "pg";
import sharp from "sharp";
import { createStorage } from "./storage.mjs";

if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
}

const CONCURRENCY = Math.max(1, Number(process.env.WORKER_CONCURRENCY ?? 2));
const MAX_ATTEMPTS = 3;
// Larger images are refused. Decoding needs ~3 bytes per pixel, so keep this
// in line with the server RAM (50 MP ≈ 150 MB; phones shoot 12–48 MP).
const MAX_PIXELS = Number(process.env.WORKER_MAX_PIXELS ?? 50_000_000);
// One quality for every package (matches the phone: app/e/[slug]/develop.tsx):
// the best photo that still uploads fast.
const QUALITY = { max_px: 3072, jpeg_quality: 88 };

sharp.cache(false);
sharp.concurrency(1); // one libvips thread per photo; parallelism comes from CONCURRENCY

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL missing");
const local = /@(127\.0\.0\.1|localhost)[:/]/.test(url);
const db = new pg.Pool({ connectionString: url, ssl: local ? false : { rejectUnauthorized: false }, max: CONCURRENCY + 1 });
db.on("error", (e) => console.error("pg pool error", e.message));
const storage = createStorage();

const keys = (eventId, photoId) => {
  const base = `ev/${eventId}/p/${photoId}/`;
  return { incoming: `ev/${eventId}/in/${photoId}`, full: `${base}full.jpg`, md: `${base}md.webp`, sm: `${base}sm.webp` };
};

async function claim() {
  const { rows } = await db.query(
    `update photos set status = 'processing', locked_at = now(), attempts = attempts + 1
     where id = (
       select id from photos
       where status = 'uploaded' or (status = 'processing' and locked_at < now() - interval '10 minutes')
       order by uploaded_at nulls first
       limit 1 for update skip locked)
     returning id, event_id, guest_id, declared_bytes, attempts`,
  );
  return rows[0] ?? null;
}

function eventSettings(e) {
  const snap = e.plan_snapshot ?? {};
  const ov = e.overrides ?? {};
  const maxMb = Number(ov.limits?.max_file_mb ?? snap.limits?.max_file_mb ?? 15);
  const moderation = (ov.features?.moderation ?? snap.features?.moderation) === true;
  return { quality: QUALITY, maxBytes: maxMb * 1024 * 1024, review: moderation && e.require_approval };
}

class Reject extends Error {}

async function process1(job) {
  const { rows } = await db.query("select id, plan_snapshot, overrides, require_approval, purged_at from events where id = $1", [job.event_id]);
  const e = rows[0];
  const k = keys(job.event_id, job.id);
  if (!e || e.purged_at) {
    await storage.delete(k.incoming).catch(() => {});
    await db.query("update photos set status = 'deleted', locked_at = null where id = $1", [job.id]);
    return "skipped";
  }
  const s = eventSettings(e);
  const buf = await storage.get(k.incoming);
  if (!buf) throw new Reject("upload missing");
  if (buf.length > s.maxBytes || buf.length > job.declared_bytes) throw new Reject(`file too large (${buf.length})`);

  let meta;
  try {
    meta = await sharp(buf, { limitInputPixels: MAX_PIXELS }).metadata();
  } catch {
    throw new Reject("not an image");
  }
  if (!["jpeg", "png", "webp"].includes(meta.format)) throw new Reject(`format ${meta.format} not allowed`);

  const q = s.quality;
  const opts = { limitInputPixels: MAX_PIXELS, failOn: "error" };
  const fits = !q.max_px || Math.max(meta.width, meta.height) <= q.max_px;
  // The phone already resized it to this event's size and it carries no
  // metadata (canvas output): decoding every pixel proves it's a real image, so
  // the bytes can be kept as they are. Anything else (originals, PNG/WebP,
  // files with EXIF/GPS) is re-encoded: .rotate() applies the EXIF orientation
  // and sharp drops all metadata on output.
  const keep = meta.format === "jpeg" && fits && !meta.exif && !meta.xmp && !meta.iptc && !meta.orientation;
  let full;
  try {
    if (keep) {
      await sharp(buf, opts).raw().toBuffer();
      full = { data: buf, info: { width: meta.width, height: meta.height } };
    } else {
      const p = sharp(buf, opts).rotate();
      if (q.max_px) p.resize({ width: q.max_px, height: q.max_px, fit: "inside", withoutEnlargement: true });
      full = await p.jpeg({ quality: q.jpeg_quality, progressive: true, chromaSubsampling: q.jpeg_quality >= 90 ? "4:4:4" : "4:2:0" }).toBuffer({ resolveWithObject: true });
    }
  } catch {
    throw new Reject("image could not be decoded");
  }
  // Previews straight from the upload: JPEG shrink-on-load makes this cheap.
  // A light sharpen after the shrink keeps previews crisp (measured: ~1.7x bytes, still small).
  const md = await sharp(buf, opts)
    .rotate()
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .sharpen({ sigma: 0.5 })
    .webp({ quality: 80, effort: 2 })
    .toBuffer();
  const sm = await sharp(md).resize({ width: 480, height: 480, fit: "inside", withoutEnlargement: true }).webp({ quality: 70, effort: 2 }).toBuffer();

  await storage.put(k.full, full.data, "image/jpeg");
  await storage.put(k.md, md, "image/webp");
  await storage.put(k.sm, sm, "image/webp");
  await storage.delete(k.incoming).catch(() => {});

  const bytes = full.data.length + md.length + sm.length;
  const client = await db.connect();
  try {
    await client.query("begin");
    const r = await client.query(
      `update photos set status = $2, bytes = $3, width = $4, height = $5, ready_at = date_trunc('milliseconds', now()), locked_at = null, error = null
       where id = $1 and status = 'processing' returning id`,
      [job.id, s.review ? "review" : "ready", bytes, full.info.width, full.info.height],
    );
    if (r.rowCount === 1) {
      await client.query("update events set photo_count = photo_count + 1, bytes_used = bytes_used + $2 where id = $1", [job.event_id, bytes]);
    }
    await client.query("commit");
  } catch (err) {
    await client.query("rollback").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
  return s.review ? "review" : "ready";
}

async function fail(job, err, final) {
  const msg = String(err?.message ?? err).slice(0, 300);
  if (final) {
    await db.query("update photos set status = $2, error = $3, locked_at = null where id = $1", [job.id, err instanceof Reject ? "rejected" : "failed", msg]);
    if (job.guest_id) await db.query("update guests set upload_count = greatest(0, upload_count - 1) where id = $1", [job.guest_id]);
    await db.query("update events set slot_count = greatest(0, slot_count - 1) where id = $1", [job.event_id]);
    await storage.delete(keys(job.event_id, job.id).incoming).catch(() => {});
  } else {
    await db.query("update photos set status = 'uploaded', locked_at = null, error = $2 where id = $1", [job.id, msg]);
  }
}

let stopping = false;
let processed = 0;

async function loop(n) {
  let idle = 250;
  while (!stopping) {
    let job = null;
    try {
      job = await claim();
    } catch (e) {
      console.error(`[w${n}] claim failed:`, e.message);
      await sleep(5000);
      continue;
    }
    if (!job) {
      await sleep(idle);
      idle = Math.min(idle * 2, 2000);
      continue;
    }
    idle = 250;
    const t = Date.now();
    try {
      const status = await process1(job);
      processed++;
      console.log(`[w${n}] ${job.id} ${status} ${Date.now() - t}ms`);
    } catch (e) {
      const final = e instanceof Reject || job.attempts >= MAX_ATTEMPTS;
      console.error(`[w${n}] ${job.id} ${final ? "FAILED" : "retry"}: ${e.message}`);
      await fail(job, e, final).catch((x) => console.error("fail() error", x.message));
      if (!final) await sleep(1000);
    }
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const shutdown = () => {
  if (stopping) return;
  stopping = true;
  console.log(`worker stopping (processed ${processed})`);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

console.log(`pixcherry worker: ${CONCURRENCY} slot(s), storage=${storage.name}`);
await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => loop(i + 1)));
await db.end();
