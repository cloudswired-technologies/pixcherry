import { expect, test, type Browser, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import pg from "pg";
import sharp from "sharp";
import { distinctPhones } from "./phones";

// Keeping albums clean: guest reports (gone for the reporter at once, hidden for
// everyone after 2), the AI check's "Hidden by AI" photos, and the host's review.

const ENV = readFileSync(".env.local", "utf8");
const DB = ENV.match(/^DATABASE_URL=(.*)$/m)![1].trim();
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

async function guest(browser: Browser, slug: string, name: string) {
  const c = await browser.newContext(PHONE);
  await c.addInitScript((s) => localStorage.setItem(`pc-install-${s}`, "1"), slug);
  const g = await c.newPage();
  await g.goto(`/e/${slug}`);
  await g.getByRole("button", { name: "Join", exact: true }).click();
  await g.getByLabel("Your name").fill(name);
  await g.getByRole("button", { name: /Let's go/ }).click();
  await expect(g.getByRole("button", { name: `You: ${name}` })).toBeVisible();
  await allPhotos(g);
  return g;
}

/** The All Photos tab (Highlights shows the same photo in several rows). */
async function allPhotos(g: Page) {
  await g.getByRole("navigation", { name: "Actions" }).getByRole("button", { name: "All Photos" }).click();
  await expect(g.getByRole("heading", { name: "All Photos" })).toBeVisible();
}

async function report(g: Page, alt: string) {
  await g.getByAltText(alt).filter({ visible: true }).first().click();
  const viewer = g.getByRole("dialog", { name: "Photo" });
  await viewer.getByRole("button", { name: "Report photo" }).click();
  const ask = g.getByRole("alertdialog", { name: "Report this photo?" });
  await ask.getByRole("button", { name: "Report", exact: true }).click();
  await expect(viewer).toHaveCount(0);
}

test("reports hide photos; host reviews AI and reported photos", async ({ browser, page }) => {
  distinctPhones(browser);
  test.setTimeout(300_000);
  // Compile the report route up front (the dev server's first compile is slow).
  await page.request.post("/api/e/no-such-event/photos/00000000-0000-0000-0000-000000000000/report", { timeout: 120_000 });
  const tag = Date.now().toString(36);
  const email = `mod-${tag}@example.com`;
  const slug = `mod-${tag}`;
  const [u] = await sql("insert into users (email) values ($1) returning id", [email]);
  const [ev] = await sql(
    `insert into events (owner_id, slug, name, starts_at, ends_at, plan_id, plan_snapshot, paid_at, deletion_at)
     select $1, $2, 'Moderation test', now() - interval '1 hour', now() + interval '3 hours', p.id,
       jsonb_build_object('code', p.code, 'name', p.name, 'price_cents', p.price_cents, 'limits', p.limits, 'features', p.features,
         'quality', json_build_object('name', q.name, 'max_px', q.max_px, 'jpeg_quality', q.jpeg_quality)),
       now(), now() + interval '9 days'
     from plans p join quality_presets q on q.id = p.quality_preset_id where p.code = 'premium' returning id`,
    [u.id, slug],
  );

  // ---------------------------------------------------------------- Siti shares 2 photos
  const siti = await guest(browser, slug, "Siti");
  await siti.locator("input[type=file][multiple]").setInputFiles([
    { name: "a.jpg", mimeType: "image/jpeg", buffer: await jpeg("#e94f6a") },
    { name: "b.jpg", mimeType: "image/jpeg", buffer: await jpeg("#3d8be8") },
  ]);
  await siti.getByRole("button", { name: /Share 2 photos/ }).click();
  await expect(siti.getByAltText("Photo by Siti").filter({ visible: true })).toHaveCount(2, { timeout: 60_000 });
  const photos = await sql("select id, status, flag, nsfw from photos where event_id = $1 order by created_at", [ev.id]);
  expect(photos).toHaveLength(2);
  // The worker's AI check ran: plain photos pass with a low score.
  for (const p of photos) {
    expect(p.status).toBe("ready");
    expect(p.flag).toBeNull();
    expect(p.nsfw).not.toBeNull();
    expect(p.nsfw).toBeLessThan(0.4);
  }

  // ---------------------------------------------------------------- reports
  const ali = await guest(browser, slug, "Ali");
  const mei = await guest(browser, slug, "Mei");
  await expect(ali.getByAltText("Photo by Siti").filter({ visible: true })).toHaveCount(2);
  // Siti can't report her own photo.
  await siti.getByAltText("Photo by Siti").filter({ visible: true }).first().click();
  await expect(siti.getByRole("dialog", { name: "Photo" }).getByRole("button", { name: "Share photo" })).toBeVisible();
  await expect(siti.getByRole("button", { name: "Report photo" })).toHaveCount(0);
  await siti.getByRole("dialog", { name: "Photo" }).getByRole("button", { name: "Close" }).click();

  // Ali reports one: it's gone for Ali (also after a reload), still there for Mei.
  await report(ali, "Photo by Siti");
  await expect(ali.getByAltText("Photo by Siti").filter({ visible: true })).toHaveCount(1);
  await ali.reload();
  await allPhotos(ali);
  await expect(ali.getByAltText("Photo by Siti").filter({ visible: true })).toHaveCount(1);
  let [r] = await sql("select id, status, report_count from photos where event_id = $1 and report_count > 0", [ev.id]);
  expect(r).toMatchObject({ status: "ready", report_count: 1 });
  await mei.reload();
  await allPhotos(mei);
  await expect(mei.getByAltText("Photo by Siti").filter({ visible: true })).toHaveCount(2);

  // Mei reports the same one: now hidden for everyone else until the host decides.
  const reported = r.id as string;
  await mei.getByAltText("Photo by Siti").filter({ visible: true }).first().click();
  for (let i = 0; i < 2; i++) {
    const shown = await mei.getByRole("dialog", { name: "Photo" }).locator("img").first().getAttribute("src");
    if (shown?.includes(reported)) break;
    await mei.keyboard.press("ArrowRight");
  }
  await mei.getByRole("button", { name: "Report photo" }).click();
  await mei.getByRole("alertdialog", { name: "Report this photo?" }).getByRole("button", { name: "Report", exact: true }).click();
  await expect(mei.getByRole("dialog", { name: "Photo" })).toHaveCount(0);
  [r] = await sql("select status, flag, report_count from photos where id = $1", [reported]);
  expect(r).toMatchObject({ status: "review", flag: "report", report_count: 2 });
  const zara = await guest(browser, slug, "Zara");
  await expect(zara.getByAltText("Photo by Siti").filter({ visible: true })).toHaveCount(1);
  // The person who shared it still sees it.
  await siti.reload();
  await allPhotos(siti);
  await expect(siti.getByAltText("Photo by Siti").filter({ visible: true })).toHaveCount(2);

  // ---------------------------------------------------------------- AI-hidden photo (as the worker marks it)
  const other = photos.find((p) => p.id !== reported)!.id as string;
  await sql("update photos set status = 'review', flag = 'ai', nsfw = 0.93 where id = $1", [other]);

  // ---------------------------------------------------------------- host review
  await page.goto(`/dashboard/events/${ev.id}/photos`);
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a code" }).click();
  await page.getByLabel("Login code").fill("123456");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("link", { name: /Waiting for approval\s*2/ })).toBeVisible();
  await page.getByRole("link", { name: /Waiting for approval/ }).click();
  await expect(page.getByText(/PixCherry checks every photo/).filter({ visible: true }).first()).toBeVisible();
  await page.screenshot({ path: "test-results/moderation-host.png", fullPage: true });
  await expect(page.getByText("Reported by 2 guests", { exact: true }).filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByText("Hidden by AI").filter({ visible: true }).first()).toBeVisible();

  // Approve the reported one: back in the album, and more reports won't hide it again.
  const card = page.locator("div.relative", { has: page.getByText("Reported by 2 guests", { exact: true }) }).filter({ visible: true }).last();
  await card.getByRole("button", { name: "Approve photo" }).click();
  await expect.poll(async () => (await sql("select status from photos where id = $1", [reported]))[0].status).toBe("ready");
  await page.reload();
  await expect(page.getByText("Hidden by AI").filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByText("Reported by 2 guests", { exact: true }).filter({ visible: true })).toHaveCount(0);
  [r] = await sql("select status, flag, approved_at from photos where id = $1", [reported]);
  expect(r.status).toBe("ready");
  expect(r.flag).toBeNull();
  expect(r.approved_at).not.toBeNull();
  await zara.reload();
  await allPhotos(zara);
  await expect(zara.getByAltText("Photo by Siti").filter({ visible: true })).toHaveCount(1); // the AI-hidden one stays hidden
  await report(zara, "Photo by Siti");
  [r] = await sql("select status, report_count from photos where id = $1", [reported]);
  expect(r).toMatchObject({ status: "ready", report_count: 3 });
});
