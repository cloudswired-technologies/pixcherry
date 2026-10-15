import { test } from "@playwright/test";
import { distinctPhones } from "./phones";
import { readFileSync } from "node:fs";
import pg from "pg";

// Debug helper: PROBE=1 npx playwright test e2e/probe.spec.ts
test.skip(!process.env.PROBE, "set PROBE=1");

test("probe camera polaroid", async ({ browser }) => {
  distinctPhones(browser);
  const DB = readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.*)$/m)![1].trim();
  const c = new pg.Client({ connectionString: DB });
  await c.connect();
  const { rows } = await c.query("select slug from events where name like 'Aina%' and purged_at is null order by created_at desc limit 1");
  await c.end();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, permissions: ["camera"] });
  const page = await ctx.newPage();
  page.on("console", (m) => console.log("CONSOLE", m.type(), m.text().slice(0, 300)));
  page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
  await page.goto(`/e/${rows[0].slug}`);
  await page.getByRole("button", { name: "Snap", exact: true }).last().click();
  const name = page.getByLabel("Your name");
  if (await name.isVisible().catch(() => false)) {
    await name.fill("Probe");
    await page.getByRole("button", { name: /Let's go/ }).click();
  }
  const cam = page.getByRole("dialog", { name: "Camera" });
  await cam.getByRole("button", { name: "Take photo" }).waitFor();
  await page.waitForTimeout(1500);
  const before = await page.evaluate(() => {
    const cv = document.querySelector('[aria-label="Camera"] canvas') as HTMLCanvasElement | null;
    return cv ? { w: cv.width, h: cv.height, cw: cv.clientWidth, ch: cv.clientHeight } : null;
  });
  console.log("before", JSON.stringify(before));
  await cam.getByRole("button", { name: "Take photo" }).click();
  await cam.getByRole("button", { name: "Share" }).click();
  await page.waitForTimeout(1500);
  console.log("ctx lost after share?", await page.evaluate(() => (document.querySelector('[aria-label="Camera"] canvas') as HTMLCanvasElement | null)?.getContext("webgl")?.isContextLost()));
  await page.screenshot({ path: "docs/screens/probe-after-share.png" });
  await cam.getByRole("button", { name: "Polaroid" }).click();
  await page.waitForTimeout(1500);
  const after = await page.evaluate(() => {
    const cv = document.querySelector('[aria-label="Camera"] canvas') as HTMLCanvasElement | null;
    const box = cv?.parentElement as HTMLElement | null;
    return cv ? { w: cv.width, h: cv.height, cw: cv.clientWidth, ch: cv.clientHeight, boxW: box?.style.width, boxH: box?.style.height, wrap: box?.parentElement?.getAttribute("style") } : "no canvas";
  });
  console.log("after", JSON.stringify(after));
  await page.screenshot({ path: "docs/screens/probe-polaroid.png" });
});
