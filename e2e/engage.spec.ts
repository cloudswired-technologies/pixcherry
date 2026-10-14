import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import pg from "pg";
import sharp from "sharp";

// Engagement features: snap missions (organiser pack), disposable camera with a
// filter + shots counter (fake webcam), hearts, people folders, top snappers,
// wishes wall, slideshow ticker, and the album ZIP with folders + wishes.txt.

const ENV = readFileSync(".env.local", "utf8");
const DB = ENV.match(/^DATABASE_URL=(.*)$/m)![1].trim();

async function sql(text: string, params: unknown[] = []) {
  const c = new pg.Client({ connectionString: DB });
  await c.connect();
  try {
    return (await c.query(text, params)).rows;
  } finally {
    await c.end();
  }
}

test("missions, camera, hearts, folders, wishes, slideshow", async ({ browser, page }) => {
  // Organiser + paid Basic event with missions switched on for this event (admin override).
  const email = `eng-${Date.now()}@example.com`;
  const [u] = await sql("insert into users (email) values ($1) returning id", [email]);
  const [plan] = await sql(
    "select p.id, p.code, p.name, p.price_cents, p.limits, p.features, json_build_object('name', q.name, 'max_px', q.max_px, 'jpeg_quality', q.jpeg_quality) quality from plans p join quality_presets q on q.id = p.quality_preset_id where p.code = 'basic'",
  );
  const snap = { plan_id: plan.id, code: plan.code, name: plan.name, price_cents: plan.price_cents, quality: plan.quality, limits: plan.limits, features: plan.features };
  const slug = `eng${Date.now().toString(36)}`.slice(0, 12).replace(/[^a-z0-9]/g, "a").padEnd(10, "a");
  const [ev] = await sql(
    `insert into events (owner_id, slug, name, starts_at, ends_at, plan_id, plan_snapshot, paid_at, deletion_at, overrides)
     values ($1, $2, 'Engage E2E', now(), now() + interval '5 hours', $3, $4, now(), now() + interval '9 days', $5) returning id`,
    [u.id, slug, plan.id, JSON.stringify(snap), JSON.stringify({ features: { missions: true, slideshow: true } })],
  );

  // Organiser logs in and adds the wedding mission pack.
  await page.goto(`/dashboard/events/${ev.id}/engage`);
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a code" }).click();
  await page.getByLabel("Login code").fill("123456");
  await page.getByRole("button", { name: "Log in" }).click();
  await page.getByRole("button", { name: "Add the wedding pack" }).click();
  await expect(page.getByText("Selfie with the couple")).toBeVisible();
  const missions = await sql("select id, title from event_missions where event_id = $1 order by sort", [ev.id]);
  expect(missions).toHaveLength(8);

  // Guest on a phone.
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, permissions: ["camera"] });
  const g = await ctx.newPage();
  await g.goto(`/e/${slug}`);
  await expect(g.getByRole("heading", { name: "🎯 Snap missions" })).toBeVisible();
  await expect(g.getByText("0/8")).toBeVisible();

  // Tap a mission -> join -> camera opens on that mission.
  await g.getByRole("button", { name: /Selfie with the couple/ }).first().click();
  await g.getByLabel("Your name").fill("Amir");
  await g.getByRole("button", { name: /Let's go/ }).click();
  const cam = g.getByRole("dialog", { name: "Camera" });
  const counter = cam.locator('[aria-live="polite"]');
  await expect(cam).toBeVisible();
  await expect(counter).toContainText("20");
  await cam.getByRole("button", { name: "Noir" }).click();
  await expect(cam.getByRole("button", { name: "Take photo" })).toBeEnabled({ timeout: 15_000 });
  // Review step: retake costs nothing, share uses a shot.
  await cam.getByRole("button", { name: "Take photo" }).click();
  await expect(cam.getByAltText("Your photo")).toBeVisible();
  await cam.getByRole("button", { name: "Retake" }).click();
  await expect(counter).toContainText("20");
  await cam.getByRole("button", { name: "Take photo" }).click();
  await cam.getByRole("button", { name: "Share" }).click();
  await expect(counter).toContainText("19");
  await expect(cam.getByAltText("Last shot")).toBeVisible();
  await cam.getByRole("button", { name: "Back to album" }).click();
  await expect(cam).toHaveCount(0);

  // Upload done + worker -> mission ticked, photo in gallery, filter applied (Noir = greyscale).
  await expect(g.getByText("1/8")).toBeVisible({ timeout: 60_000 });
  await g.getByRole("button", { name: "All Photos", exact: true }).click();
  await expect(g.getByAltText("Photo by Amir")).toHaveCount(1, { timeout: 60_000 });
  const [shot] = await sql("select id, mission_id, width from photos where event_id = $1 and status = 'ready'", [ev.id]);
  expect(shot.mission_id).toBe(missions[0].id);
  const full = await g.request.get(`/api/e/${slug}/photos/${shot.id}/download`);
  const stats = await sharp(await full.body()).stats();
  const [r, gr, b] = stats.channels;
  expect(Math.abs(r.mean - gr.mean)).toBeLessThan(3); // greyscale: channels match
  expect(Math.abs(gr.mean - b.mean)).toBeLessThan(3);

  // A second guest uploads from the gallery picker (with the review step), hearts Amir's photo.
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const g2 = await ctx2.newPage();
  await g2.goto(`/e/${slug}`);
  await g2.getByRole("button", { name: "Upload" }).click();
  await g2.getByLabel("Your name").fill("Nora");
  await g2.getByRole("button", { name: /Let's go/ }).click();
  await expect(g2.getByText(/You have\s*20\s*shots left/)).toBeVisible();
  const img = await sharp({ create: { width: 900, height: 700, channels: 3, background: "#3d8be8" } }).jpeg().toBuffer();
  await g2.locator("input[type=file][multiple]").setInputFiles({ name: "a.jpg", mimeType: "image/jpeg", buffer: img });
  await expect(g2.getByRole("dialog", { name: "Ready to share?" })).toBeVisible();
  await g2.getByRole("button", { name: /Share 1 photo/ }).click();
  await expect(g2.getByRole("status")).toContainText("Shared!", { timeout: 60_000 });
  await g2.getByRole("button", { name: "All Photos", exact: true }).click();
  await expect(g2.getByAltText("Photo by Amir")).toHaveCount(1, { timeout: 30_000 });
  await g2.getByAltText("Photo by Amir").click();
  const [voteRes] = await Promise.all([
    g2.waitForResponse((r) => r.url().includes("/vote")),
    g2.getByRole("button", { name: "Heart this photo" }).click(),
  ]);
  expect(voteRes.status(), await voteRes.text()).toBe(200);
  await expect(g2.getByRole("button", { name: "Remove heart" })).toContainText("1");
  await g2.getByRole("button", { name: "Close" }).click();
  expect((await sql("select vote_count from photos where id = $1", [shot.id]))[0].vote_count).toBe(1);

  // People folders.
  await g2.getByRole("button", { name: "By People" }).click();
  await g2.getByRole("button", { name: /Amir/ }).first().click();
  await expect(g2.getByRole("heading", { name: "Photos by Amir" })).toBeVisible();
  await expect(g2.getByAltText("Photo by Amir")).toHaveCount(1);
  await expect(g2.getByAltText("Photo by Nora")).toHaveCount(0);

  // Highlights: top snappers + most loved.
  await g2.getByRole("button", { name: "Highlights" }).click();
  await expect(g2.getByRole("heading", { name: "🏆 Top snappers" })).toBeVisible({ timeout: 25_000 });
  await expect(g2.locator("li", { hasText: "Amir" })).toBeVisible({ timeout: 25_000 });

  // Wishes.
  await g2.getByRole("button", { name: "Write a wish" }).click();
  await g2.getByRole("textbox").fill("Congratulations Aina & Hakim! Bahagia selalu ❤️");
  await g2.getByRole("button", { name: "Send wish" }).click();
  await expect(g2.getByText("Congratulations Aina & Hakim! Bahagia selalu ❤️")).toBeVisible();
  await expect(g2.getByText("— Nora")).toBeVisible();

  // Organiser sees and can hide the wish.
  await page.reload();
  await expect(page.getByText("Congratulations Aina & Hakim!")).toBeVisible();

  // Slideshow shows the ticker.
  const tv = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  await tv.goto(`/e/${slug}/slideshow`);
  await expect(tv.getByText(/💌 Nora: Congratulations/).first()).toBeVisible({ timeout: 20_000 });
  await tv.close();

  // Album: folders per guest + wishes.txt.
  const zip = (await page.request.get(`/api/e/${slug}/album`)).body();
  const text = (await zip).toString("latin1");
  expect(text).toContain("wishes.txt");
  expect(text).toMatch(/Amir-[0-9a-f]{4}\/0001\.jpg/);
  expect(text).toMatch(/Nora-[0-9a-f]{4}\/0001\.jpg/);

  // Organiser deletes the event: wrong name refused, right name deletes everything.
  await page.goto(`/dashboard/events/${ev.id}/settings`);
  const del = page.getByRole("button", { name: "Delete event and all photos" });
  await page.locator('input[name="confirm"]').fill("wrong name");
  await expect(del).toBeDisabled();
  await page.locator('input[name="confirm"]').fill("Engage E2E");
  await del.click();
  await expect(page).toHaveURL(/\/dashboard\?deleted=1/);
  await expect(page.getByText("The event was deleted.")).toBeVisible();
  const [after] = await sql(
    "select purged_at, (select count(*)::int from wishes where event_id = $1) as wishes, (select count(*)::int from photos where event_id = $1 and status <> 'deleted') as photos from events where id = $1",
    [ev.id],
  );
  expect(after.purged_at).toBeTruthy();
  expect(after.wishes).toBe(0);
  expect(after.photos).toBe(0);
  await g2.reload();
  await expect(g2.getByRole("heading", { name: "This album has closed" })).toBeVisible();

  await ctx.close();
  await ctx2.close();
});
