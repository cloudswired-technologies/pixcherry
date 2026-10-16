// Dev helper: screenshot a page of the newest paid local event on a phone-sized screen.
// Usage: node scripts/dev-shot.mjs "/e/{slug}/slideshow" out.png [waitMs]
import { readFileSync } from "node:fs";
import pg from "pg";
import { chromium } from "@playwright/test";

const env = readFileSync(".env.local", "utf8");
const db = new pg.Client({ connectionString: env.match(/^DATABASE_URL=(.*)$/m)[1].trim() });
await db.connect();
const {
  rows: [e],
} = await db.query("select id, slug from events where paid_at is not null and purged_at is null and photo_count > 0 order by created_at desc limit 1");
await db.end();
const b = await chromium.launch({ channel: "msedge" });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await p.goto(`http://localhost:3000${process.argv[2].replace("{slug}", e.slug).replace("{id}", e.id)}`);
await p.waitForTimeout(Number(process.argv[4] ?? 4000));
await p.screenshot({ path: process.argv[3] });
await b.close();
console.log("saved", process.argv[3]);
