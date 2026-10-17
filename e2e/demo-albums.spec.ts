import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import pg from "pg";
import sharp from "sharp";
import { distinctPhones } from "./phones";

// Demo albums (pixcherry.com/demo): admin sets them up, a visitor opens one on two
// phones, snaps on one and sees it on the other; visitors' photos clear after 24 h
// (hourly cron) or at once (admin "Clear"), the sample photos stay.

const ENV = readFileSync(".env.local", "utf8");
const DB = ENV.match(/^DATABASE_URL=(.*)$/m)![1].trim();
const CRON = ENV.match(/^CRON_SECRET=(.*)$/m)![1].trim();
const PHONE = {
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
};

async function sql(text: string, params: unknown[] = []) {
  const c = new pg.Client({ connectionString: DB });
  await c.connect();
  try {
    return (await c.query(text, params)).rows;
  } finally {
    await c.end();
  }
}

const jpeg = (color: string) => sharp({ create: { width: 900, height: 1200, channels: 3, background: color } }).jpeg().toBuffer();

async function join(p: Page, slug: string, name: string) {
  await p.addInitScript((s) => localStorage.setItem(`pc-install-${s}`, "1"), slug);
  await p.goto(`/e/${slug}`);
  await expect(p.getByText("Live demo.", { exact: true })).toBeVisible();
  await p.getByRole("button", { name: "Join", exact: true }).click();
  await p.getByLabel("Your name").fill(name);
  await p.getByRole("button", { name: /Let's go/ }).click();
  await expect(p.getByRole("button", { name: `You: ${name}` })).toBeVisible();
}

async function share(p: Page, color: string) {
  await p.locator("input[type=file][multiple]").setInputFiles([{ name: "x.jpg", mimeType: "image/jpeg", buffer: await jpeg(color) }]);
  await p.getByRole("button", { name: /Share 1 photo/ }).click();
}

test("demo albums: set up, two phones, clear after 24 h and on demand", async ({ browser, page }) => {
  distinctPhones(browser);
  test.setTimeout(300_000);

  // ---------------------------------------------------------------- admin sets them up
  await page.goto("/admin/demos");
  await page.getByLabel("Email").fill("admin@example.com");
  await page.getByRole("button", { name: "Email me a code" }).click();
  await page.getByLabel("Login code").fill("123456");
  await page.getByRole("button", { name: "Log in" }).click();
  await page.getByRole("button", { name: /(Set up|Refresh) demo albums/ }).click();
  await expect(page.getByText(/6 demo albums ready/)).toBeVisible({ timeout: 120_000 });

  const demos = await sql("select id, slug, demo_key, deletion_at, overrides from events where is_demo order by demo_key");
  expect(demos).toHaveLength(6);
  for (const d of demos) {
    expect(d.deletion_at).toBeNull();
    expect(d.overrides.limits.photos_per_guest).toBe(10);
  }
  const wedding = demos.find((d) => d.demo_key === "wedding")!;
  // The worker turns the three sample photos into previews.
  await expect.poll(async () => (await sql("select photo_count from events where id = $1", [wedding.id]))[0].photo_count, { timeout: 120_000 }).toBeGreaterThanOrEqual(3);

  // ---------------------------------------------------------------- the public page
  await page.goto("/demo");
  await expect(page.getByRole("heading", { name: "Try it with two phones" })).toBeVisible();
  await expect(page.locator("article")).toHaveCount(6);
  await expect(page.getByRole("heading", { name: "Majlis Perkahwinan Aina & Hakim" })).toBeVisible();
  const open = page.locator("article", { hasText: "Majlis Perkahwinan Aina & Hakim" }).getByRole("link", { name: /Open demo/ });
  await expect(open).toHaveAttribute("href", new RegExp(`/${wedding.slug}$`));

  // ---------------------------------------------------------------- two phones
  const ctxA = await browser.newContext(PHONE);
  const ctxB = await browser.newContext(PHONE);
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();
  await join(b, wedding.slug, "Nora");
  await expect(b.getByAltText("Photo by Farah").first()).toBeVisible();
  await join(a, wedding.slug, "Ali");
  await expect(a.getByText(/You have\s*10\s*shots left/)).toBeVisible();
  // "2nd phone" shows the QR code.
  await a.getByRole("button", { name: "2nd phone" }).click();
  await expect(a.getByRole("dialog", { name: "Scan to join" }).getByText("Scan this with a second phone")).toBeVisible();
  await a.getByRole("dialog", { name: "Scan to join" }).getByRole("button", { name: "Close" }).click();
  await share(a, "#e94f6a");
  // Phone B sees it without reloading.
  await expect(b.getByAltText("Photo by Ali").first()).toBeVisible({ timeout: 60_000 });

  // ---------------------------------------------------------------- 24 hours later (hourly cron)
  const [ali] = await sql("select id from guests where event_id = $1 and name = 'Ali'", [wedding.id]);
  await sql("update photos set created_at = now() - interval '25 hours' where guest_id = $1", [ali.id]);
  await sql("update guests set created_at = now() - interval '25 hours' where id = $1", [ali.id]);
  const cron = await page.request.post("/api/cron/hourly", { headers: { authorization: `Bearer ${CRON}` } });
  expect(cron.ok()).toBe(true);
  expect((await cron.json()).demo.photos).toBeGreaterThanOrEqual(1);
  expect(await sql("select 1 from guests where id = $1", [ali.id])).toHaveLength(0);
  expect(await sql("select 1 from photos where guest_id is null and event_id = $1 and status <> 'deleted'", [wedding.id])).toHaveLength(0);
  const seeds = await sql("select count(*)::int n from photos p join guests g on g.id = p.guest_id where p.event_id = $1 and g.is_seed and p.status = 'ready'", [wedding.id]);
  expect(seeds[0].n).toBe(3);
  // Nora joined just now: she stays.
  expect(await sql("select 1 from guests where event_id = $1 and name = 'Nora'", [wedding.id])).toHaveLength(1);
  // Ali's old cookie no longer works: the phone joins again with a full roll.
  await a.reload();
  await expect(a.getByRole("button", { name: "Join", exact: true })).toBeVisible();

  // ---------------------------------------------------------------- admin "Clear now"
  await share(b, "#3d8be8");
  await expect(b.getByAltText("Photo by Nora").first()).toBeVisible({ timeout: 60_000 });
  await page.goto("/admin/demos");
  const row = page.locator("div.rounded-2xl", { hasText: "Majlis Perkahwinan Aina & Hakim" });
  await expect(row.getByText(/visitors now: 1 photos/)).toBeVisible();
  await row.getByRole("button", { name: "Clear visitors' photos" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Clear now" }).click();
  await expect(row.getByText(/visitors now: 0 photos, 0 phones/)).toBeVisible();
  const [ev] = await sql("select photo_count, guest_count, slot_count from events where id = $1", [wedding.id]);
  expect(ev.photo_count).toBe(3);
  expect(ev.slot_count).toBe(3);
  expect(ev.guest_count).toBe(3); // the seed guests: Farah, Hafiz, Mak Long

  await ctxA.close();
  await ctxB.close();
});
