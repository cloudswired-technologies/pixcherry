import { test } from "@playwright/test";
import { readFileSync } from "node:fs";
import pg from "pg";

// Debug helper: PROBE=1 npx playwright test e2e/probe.spec.ts
test.skip(!process.env.PROBE, "set PROBE=1");

test("probe guest page", async ({ browser }) => {
  const DB = readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.*)$/m)![1].trim();
  const c = new pg.Client({ connectionString: DB });
  await c.connect();
  const { rows } = await c.query("select slug from events where photo_count > 0 and purged_at is null order by created_at desc limit 1");
  await c.end();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.on("console", (m) => m.type() === "error" && console.log("CONSOLE:", m.text().slice(0, 3000)));
  await page.goto(`/e/${rows[0].slug}`);
  await page.waitForTimeout(3000);
  const imgs = await page.$$eval("section img", (els) => els.map((e) => ({ src: (e as HTMLImageElement).src.slice(-60), w: (e as HTMLImageElement).naturalWidth })));
  console.log(JSON.stringify(imgs.slice(0, 4)));
});
