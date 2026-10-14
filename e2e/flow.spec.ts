import { expect, test, type Browser, type Page } from "@playwright/test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import sharp from "sharp";

// Whole journey: organiser signs up, creates + activates an event (100% promo),
// a guest joins on a phone and uploads, the worker processes, gallery/viewer/
// downloads work, organiser deletes a photo, admin overrides the guest limit,
// and the hourly cron deletes everything after the retention period.

const ENV = readFileSync(".env.local", "utf8");
const DB = ENV.match(/^DATABASE_URL=(.*)$/m)![1].trim();
const CRON = ENV.match(/^CRON_SECRET=(.*)$/m)?.[1].trim() ?? "dev-only-CRON_SECRET-not-for-production-use";
const FIX = join("e2e", ".fixtures");
const db = () => new pg.Client({ connectionString: DB });

async function sql(text: string, params: unknown[] = []) {
  const c = db();
  await c.connect();
  try {
    return (await c.query(text, params)).rows;
  } finally {
    await c.end();
  }
}

async function login(page: Page, email: string, next: string) {
  await page.goto(next);
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a code" }).click();
  await page.getByLabel("Login code").fill("123456");
  await page.getByRole("button", { name: "Log in" }).click();
}

async function fixtures() {
  mkdirSync(FIX, { recursive: true });
  const make = async (name: string, w: number, h: number, color: string, fmt: "jpeg" | "png") => {
    const p = join(FIX, name);
    if (!existsSync(p)) {
      const img = sharp({ create: { width: w, height: h, channels: 3, background: color } });
      writeFileSync(p, await (fmt === "png" ? img.png() : img.jpeg({ quality: 90 })).toBuffer());
    }
    return p;
  };
  const files = [
    await make("big.jpg", 4000, 3000, "#e8553d", "jpeg"),
    await make("small.jpg", 800, 600, "#3d8be8", "jpeg"),
    await make("pic.png", 1200, 1600, "#3de88b", "png"),
  ];
  const bad = join(FIX, "not-a-photo.jpg");
  writeFileSync(bad, "this is not an image");
  return { files, bad };
}

async function guestPage(browser: Browser, url: string) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(url);
  return page;
}

test("organiser → guest upload → gallery → downloads → admin → retention", async ({ page, browser, request }) => {
  const { files, bad } = await fixtures();
  const email = `org-${Date.now()}@example.com`;
  await sql("insert into promo_codes (code, percent_off) values ('E2EFREE', 100) on conflict (code) do update set is_active = true, used_count = 0");

  // --- organiser creates and activates an event
  await login(page, email, "/dashboard/events/new?plan=basic");
  await expect(page.getByRole("heading", { name: "Create your event" })).toBeVisible();
  await page.getByLabel("Event name").fill("Aina & Hakim E2E");
  await page.getByRole("button", { name: "Continue to package" }).click();
  await expect(page.getByRole("heading", { name: "Choose a package" })).toBeVisible();
  const basic = page.locator("div.rounded-3xl", { hasText: "Basic" }).first();
  await basic.getByLabel("Promo code (optional)").fill("e2efree");
  await basic.getByRole("button", { name: /^Pay RM/ }).click();
  await expect(page.getByRole("heading", { name: "You're all set" })).toBeVisible();
  await page.getByRole("link", { name: "Get your QR code" }).click();
  await expect(page.getByAltText("QR code for the guest page")).toBeVisible();
  const guestUrl = (await page.locator("div.font-mono").first().innerText()).trim();
  expect(guestUrl).toMatch(/\/e\/[a-z0-9]{10}$/);
  const slug = guestUrl.split("/e/")[1];
  const [ev] = await sql("select id, deletion_at, plan_snapshot->>'code' as plan from events where slug = $1", [slug]);
  expect(ev.plan).toBe("basic");
  expect(ev.deletion_at).toBeTruthy();

  const qr = await page.request.get(`/api/events/${ev.id}/qr`);
  expect(qr.status()).toBe(200);
  expect(qr.headers()["content-type"]).toBe("image/png");

  // --- guest joins on a phone and uploads 3 photos + 1 broken file
  const guest = await guestPage(browser, guestUrl);
  await expect(guest.getByRole("heading", { name: "Aina & Hakim E2E" })).toBeVisible();
  await guest.getByRole("button", { name: "Upload" }).click();
  await expect(guest.getByRole("dialog", { name: "Join the album" })).toBeVisible();
  await guest.getByLabel("Your name").fill("Siti");
  await guest.getByRole("button", { name: /Let's go/ }).click();
  await expect(guest.getByText(/You have\s*20\s*shots left/)).toBeVisible();
  await guest.locator("input[type=file][multiple]").setInputFiles([...files, bad]);
  await expect(guest.getByText("3 shared")).toBeVisible({ timeout: 90_000 });
  await expect(guest.getByText(/You have\s*17\s*shots left/)).toBeVisible();

  // worker processes them; gallery picks them up by polling
  await expect(guest.getByAltText("Photo by Siti")).toHaveCount(3, { timeout: 60_000 });
  const photos = await sql("select status, width, height, bytes from photos where event_id = $1 and status = 'ready' order by width desc", [ev.id]);
  expect(photos).toHaveLength(3);
  expect(photos[0].width).toBe(2048); // 4000px resized on the phone to the Basic preset

  // viewer + single download
  await guest.getByAltText("Photo by Siti").first().click();
  const dl = guest.getByRole("link", { name: "Download photo" });
  await expect(dl).toBeVisible();
  const one = await guest.request.get((await dl.getAttribute("href"))!);
  expect(one.status()).toBe(200);
  expect(one.headers()["content-type"]).toBe("image/jpeg");
  const exif = await sharp(await one.body()).metadata();
  expect(exif.exif).toBeUndefined();
  await guest.getByRole("button", { name: "Close" }).click();

  // Basic: guests cannot download the album; the organiser can
  expect((await guest.request.get(`/api/e/${slug}/album`)).status()).toBe(403);
  const zip = await page.request.get(`/api/e/${slug}/album`);
  expect(zip.status()).toBe(200);
  const zipBody = await zip.body();
  expect(zipBody.subarray(0, 2).toString()).toBe("PK");
  expect(zipBody.toString("latin1").split("PK\x01\x02").length - 1).toBe(3);
  expect(zipBody.toString("latin1")).toMatch(/Siti-[0-9a-f]{4}\/0001\.jpg/); // one folder per guest

  // --- organiser deletes one photo
  await page.goto(`/dashboard/events/${ev.id}/photos`);
  await page.getByRole("button", { name: "Delete photo" }).first().click();
  await expect(page.getByRole("button", { name: "Delete photo" })).toHaveCount(2);
  const [after] = await sql("select photo_count from events where id = $1", [ev.id]);
  expect(after.photo_count).toBe(2);

  // --- admin lowers this guest limit to 4 for the event
  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  await login(admin, "admin@example.com", `/admin/events/${ev.id}`);
  await expect(admin.getByRole("heading", { name: "Overrides for this event" })).toBeVisible();
  await admin.locator('input[name="limit_photos_per_guest"]').fill("4");
  await admin.locator('input[name="note"]').fill("e2e test");
  await admin.getByRole("button", { name: "Save overrides" }).click();
  await expect(admin.getByText("Overrides saved")).toBeVisible();
  await guest.reload();
  await expect(guest.getByText(/You have\s*1\s*shot left/)).toBeVisible();
  await guest.locator("input[type=file][multiple]").setInputFiles(files.slice(0, 2));
  await expect(guest.getByText(/Only 1 more photo\(s\) allowed/)).toBeVisible();
  await expect(guest.getByText("1 shared")).toBeVisible({ timeout: 60_000 });

  // admin pages render
  for (const p of ["/admin", "/admin/events", "/admin/plans", "/admin/quality", "/admin/addons", "/admin/promos", "/admin/settings", "/admin/logs"]) {
    const r = await admin.goto(p);
    expect(r?.status(), p).toBe(200);
  }

  // --- retention: pretend the storage period ended, run the hourly job
  await sql("update events set deletion_at = now() - interval '1 minute' where id = $1", [ev.id]);
  const cron = await request.post("/api/cron/hourly", { headers: { authorization: `Bearer ${CRON}` } });
  expect(cron.status()).toBe(200);
  const result = await cron.json();
  expect(result.purged.events).toBeGreaterThanOrEqual(1);
  expect(existsSync(join(".local-storage", "ev", ev.id))).toBeFalsy();
  await guest.reload();
  await expect(guest.getByRole("heading", { name: "This album has closed" })).toBeVisible();
  await adminCtx.close();
});
