// Turn the showcase screenshots (docs/screens/demo, from e2e/demo.spec.ts) into the
// web images used by the landing page and the guide (public/landing/*.webp), and
// fetch the event's real QR card. Run with the local dev server up:
//   node scripts/landing-assets.mjs
import { createHmac } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import sharp from "sharp";

const SRC = "docs/screens/demo";
const OUT = "public/landing";
mkdirSync(OUT, { recursive: true });
const files = readdirSync(SRC);
const find = (name) => {
  const f = files.find((x) => x.replace(/^\d+-/, "").replace(/\.png$/, "") === name);
  if (!f) throw new Error(`missing screenshot: ${name}`);
  return join(SRC, f);
};

// [output, screenshot, width]
const MAP = [
  ["hero-phone", "guest-home", 780],
  ["hero-tv", "slideshow-tv", 1600],
  ["step-join", "guest-join", 780],
  ["step-snap", "camera-kodak-gold", 780],
  ["step-album", "guest-all-photos", 780],
  ["f-camera", "camera-kodak-gold", 780],
  ["f-camera-review", "camera-review", 780],
  ["f-highlights", "guest-highlights", 780],
  ["f-missions", "guest-missions", 780],
  ["f-viewer", "guest-viewer", 780],
  ["f-wishes", "guest-wishes", 780],
  ["f-slideshow", "slideshow-tv-2", 1600],
  ["f-host", "host-overview-live-desktop", 1600],
  ["f-recap", "recap", 780],
  ["f-corporate-tv", "corporate-slideshow-tv", 1600],
  ["f-corporate-phone", "corporate-all-photos", 780],
  ["guide-create", "create-event-desktop", 1600],
  ["guide-checkout", "checkout-desktop", 1600],
  ["guide-missions", "missions-desktop", 1600],
  ["guide-qr", "qr-desktop", 1600],
  ["guide-host", "host-overview-desktop", 1600],
  ["guide-photos", "host-photos-desktop", 1600],
  ["guide-guest-open", "guest-first-visit", 780],
  ["guide-guest-join", "guest-join", 780],
  ["guide-guest-camera", "camera-kodak-gold", 780],
  ["guide-guest-highlights", "guest-highlights", 780],
];

let total = 0;
for (const [out, name, width] of MAP) {
  const src = find(name);
  const meta = await sharp(src).metadata();
  // Phone shots keep one screen's height (tall full-page shots are cut at the fold).
  const phone = width === 780;
  const p = sharp(src);
  if (phone) p.extract({ left: 0, top: 0, width: meta.width, height: Math.min(meta.height, Math.round(meta.width * (844 / 390))) });
  const buf = await p.resize({ width, withoutEnlargement: true }).webp({ quality: phone ? 78 : 80, effort: 5 }).toBuffer();
  writeFileSync(join(OUT, `${out}.webp`), buf);
  total += buf.length;
}

// The real QR card of the showcase wedding, fetched as its organiser.
const env = readFileSync(".env.local", "utf8");
const val = (k) => env.match(new RegExp(`^${k}=(.*)$`, "m"))?.[1]?.trim();
const { wedding } = JSON.parse(readFileSync(join(SRC, "events.json"), "utf8"));
const db = new pg.Client({ connectionString: val("DATABASE_URL") });
await db.connect();
const { rows: [u] } = await db.query("select u.id, u.session_version v from events e join users u on u.id = e.owner_id where e.id = $1", [wedding.id]);
await db.end();
const secret = val("SESSION_SECRET") || "dev-only-SESSION_SECRET-not-for-production-use";
const payload = Buffer.from(JSON.stringify({ uid: u.id, v: u.v, exp: Date.now() + 600_000 })).toString("base64url");
const r = await fetch(`http://localhost:3000/api/events/${wedding.id}/card`, { headers: { cookie: `pc_session=${payload}.${createHmac("sha256", secret).update(payload).digest("base64url")}` } });
if (!r.ok) throw new Error(`QR card: ${r.status}`);
const card = await sharp(Buffer.from(await r.arrayBuffer())).resize({ width: 640 }).webp({ quality: 85 }).toBuffer();
writeFileSync(join(OUT, "qr-card.webp"), card);
writeFileSync(join(OUT, "step-qr.webp"), card);
total += card.length * 2;

// Explainer video (e2e/video.spec.ts, trimmed + encoded with ffmpeg: guest.mp4, guest-web.webm),
// its chapters, and the first frame as the poster.
const V = join(SRC, "video");
for (const [from, to] of [["guest.mp4", "guest.mp4"], ["guest-web.webm", "guest.webm"], ["chapters.json", "chapters.json"]]) {
  if (!existsSync(join(V, from))) throw new Error(`missing video file: ${from}`);
  copyFileSync(join(V, from), join(OUT, to));
}
writeFileSync(join(OUT, "video-poster.webp"), await sharp(join(V, "frame-start.png")).webp({ quality: 80 }).toBuffer());
console.log(`${MAP.length + 2} images → ${OUT} (${(total / 1024).toFixed(0)} KB)`);
