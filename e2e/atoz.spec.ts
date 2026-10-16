import { expect, test, type Page } from "@playwright/test";
import { distinctPhones } from "./phones";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import pg from "pg";
import sharp from "sharp";

// A-to-Z walk through every screen on a phone, as the organiser, two guests and
// the admin would use it. Every screen is checked for sideways scrolling and for
// the bottom menu covering content, and screenshotted to docs/screens/atoz-*.png.
//   ATOZ=1 npx playwright test e2e/atoz.spec.ts

test.skip(!process.env.ATOZ, "set ATOZ=1");

const DB = readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.*)$/m)![1].trim();
const OUT = "docs/screens";
const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

async function sql(text: string, params: unknown[] = []) {
  const c = new pg.Client({ connectionString: DB });
  await c.connect();
  try {
    return (await c.query(text, params)).rows;
  } finally {
    await c.end();
  }
}

let n = 0;
const problems: string[] = [];
/** Screenshot + layout checks for the current screen. */
async function shot(page: Page, name: string, opts: { full?: boolean; bar?: boolean } = {}) {
  await page.waitForTimeout(400);
  await page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 10_000 }).catch(() => {});
  const wide = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: window.innerWidth }));
  if (wide.sw > wide.w + 1) problems.push(`${name}: page is ${wide.sw}px wide on a ${wide.w}px screen (sideways scroll)`);
  if (opts.bar) {
    // Scroll to the bottom: the last real content must end above the fixed bottom menu.
    const cover = await page.evaluate(async () => {
      window.scrollTo(0, document.documentElement.scrollHeight);
      await new Promise((r) => setTimeout(r, 300));
      const bar = document.querySelector('nav[aria-label="Actions"]');
      const main = document.querySelector("main");
      const last = main?.lastElementChild ?? main;
      if (!bar || !last) return null;
      return { lastBottom: last.getBoundingClientRect().bottom, barTop: bar.getBoundingClientRect().top };
    });
    if (cover && cover.lastBottom > cover.barTop + 1) problems.push(`${name}: bottom menu covers content (${Math.round(cover.lastBottom - cover.barTop)}px)`);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(200);
  }
  n++;
  await page.screenshot({ path: `${OUT}/atoz-${String(n).padStart(2, "0")}-${name}.png`, fullPage: !!opts.full });
}

test("A to Z on a phone", async ({ browser }) => {
  distinctPhones(browser);
  test.setTimeout(600_000);
  mkdirSync(OUT, { recursive: true });
  const photos: Buffer[] = [];
  for (const c of ["#e8553d", "#3d8be8", "#3de88b", "#d49b2e", "#6f63b8"]) {
    photos.push(await sharp({ create: { width: 1600, height: 1200, channels: 3, background: c } }).jpeg({ quality: 85 }).toBuffer());
  }

  // ------------------------------------------------------------------ public + organiser
  const org = await browser.newContext(PHONE);
  const o = await org.newPage();
  await o.goto("/");
  await shot(o, "landing");
  await o.getByRole("button", { name: "Menu" }).or(o.locator("summary[aria-label=Menu]")).first().click();
  await shot(o, "landing-menu");
  await o.goto("/dashboard/events/new?plan=premium");
  await shot(o, "login");
  await o.getByLabel("Email").fill("admin@example.com");
  await o.getByRole("button", { name: "Email me a code" }).click();
  await o.getByLabel("Login code").fill("123456");
  await o.getByRole("button", { name: "Log in" }).click();
  await expect(o.getByRole("heading", { name: "Create your event" })).toBeVisible();
  await o.getByLabel("Event name").fill("Aina & Hakim's Wedding");
  await o.getByLabel("Venue (optional)").fill("The Majestic Hotel");
  await o.getByLabel("Message for guests (optional)").fill("Thank you for celebrating with us! Snap away 💕");
  await shot(o, "create-event");
  await o.getByRole("button", { name: "Continue to package" }).click();
  await expect(o.getByRole("heading", { name: "Choose a package" })).toBeVisible();
  await shot(o, "checkout", { full: true });
  const id = o.url().split("/events/")[1].split("/")[0];
  const [premium] = await sql("select id from plans where code = 'premium'");
  await o.goto(`/admin/events/${id}`);
  await o.locator('select[name="plan_id"]').selectOption(premium.id);
  await o.getByRole("button", { name: "Activate" }).click();
  // Activated: the page now offers "Adjust this event" instead of activation.
  await expect(o.getByRole("heading", { name: "Adjust this event" })).toBeVisible();
  await shot(o, "admin-event");
  const [ev] = await sql("select slug from events where id = $1", [id]);
  // The album opens at the start time: make the event live for the guest part.
  await sql("update events set starts_at = now() - interval '1 hour', ends_at = now() + interval '5 hours' where id = $1", [id]);
  await o.goto(`/dashboard/events/${id}/engage`);
  for (const idea of ["Selfie with the host", "Big group photo", "A big candid laugh"]) {
    await o.getByRole("button", { name: `Add idea: ${idea}` }).click();
    await expect(o.getByRole("button", { name: `Add idea: ${idea}` })).toHaveCount(0);
  }
  await shot(o, "organiser-missions");
  await o.goto(`/dashboard/events/${id}/settings`);
  await o.getByLabel("Thank-you message (optional)").fill("Thank you for every smile and every photo. Love, Aina & Hakim");
  await o.getByRole("button", { name: "Save changes" }).click();
  await expect(o.getByText("Saved.")).toBeVisible();
  await shot(o, "organiser-settings");
  await o.goto(`/dashboard/events/${id}`);
  await shot(o, "organiser-overview");
  await o.goto(`/dashboard/events/${id}/qr`);
  await shot(o, "qr-card");
  await o.goto("/dashboard");
  await shot(o, "organiser-events");

  // ------------------------------------------------------------------ guest 1: gallery upload with review
  const g1c = await browser.newContext({ ...PHONE, permissions: ["camera"] });
  const g1 = await g1c.newPage();
  // Desktop Edge supports file sharing and would open the Windows share sheet; use the download fallback.
  await g1.addInitScript(() => Object.defineProperty(navigator, "canShare", { value: undefined }));
  await g1.goto(`/e/${ev.slug}`);
  await shot(g1, "guest-first-visit", { bar: true });
  await g1.getByRole("button", { name: "Upload" }).click();
  await g1.getByLabel("Your name").fill("Siti");
  await shot(g1, "guest-join");
  await g1.getByRole("button", { name: /Let's go/ }).click();
  await expect(g1.getByText(/You have\s*\d+\s*shots left/)).toBeVisible();
  await g1.locator("input[type=file][multiple]").setInputFiles(photos.map((b, i) => ({ name: `p${i}.jpg`, mimeType: "image/jpeg", buffer: b })));
  await expect(g1.getByRole("dialog", { name: "Ready to share?" })).toBeVisible();
  await shot(g1, "guest-upload-review");
  await g1.getByRole("button", { name: "Remove photo" }).first().click();
  await g1.getByRole("dialog", { name: "Ready to share?" }).getByRole("button", { name: "#reception" }).click();
  await g1.getByRole("button", { name: /Share 4 photos/ }).click();
  await expect(g1.getByRole("status")).toContainText("photos shared", { timeout: 60_000 });
  await shot(g1, "guest-shared-toast");
  await g1.getByRole("navigation", { name: "Sections" }).getByRole("button", { name: "All Photos" }).click();
  await expect(g1.getByAltText("Photo by Siti")).toHaveCount(4, { timeout: 60_000 });

  // ------------------------------------------------------------------ guest 2: camera, mission, wish, hearts
  const g2c = await browser.newContext({ ...PHONE, permissions: ["camera"] });
  const g2 = await g2c.newPage();
  await g2.goto(`/e/${ev.slug}`);
  await g2.getByRole("button", { name: /Selfie with the host/ }).first().click();
  await g2.getByLabel("Your name").fill("Amir");
  await g2.getByRole("button", { name: /Let's go/ }).click();
  // Snap = the PixCamera (fake webcam in tests): looks, zoom, review with hashtags + caption.
  const cam = g2.getByRole("dialog", { name: "Camera" });
  await expect(cam.getByRole("button", { name: "Take photo" })).toBeEnabled({ timeout: 15_000 });
  for (const look of ["Natural", "Disposable", "Cinematic", "Y2K Digicam", "Polaroid"]) {
    await cam.getByRole("button", { name: look }).click();
    await shot(g2, `camera-${look.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`);
  }
  await cam.getByRole("button", { name: "Kodak Gold" }).click();
  await cam.getByRole("button", { name: "Zoom 2×" }).click();
  await shot(g2, "camera-zoom");
  await cam.getByRole("button", { name: "Take photo" }).click();
  await expect(cam.getByAltText("Your photo")).toBeVisible();
  await cam.getByRole("button", { name: "Hashtags" }).click();
  const tagPanel = cam.getByRole("dialog", { name: "Add hashtags" });
  await tagPanel.getByRole("button", { name: "#selfie" }).click();
  await tagPanel.getByLabel("Add your own hashtag").fill("bestday");
  await tagPanel.getByLabel("Add your own hashtag").press("Enter");
  await expect(tagPanel.getByRole("button", { name: "#bestday" })).toHaveAttribute("aria-pressed", "true");
  await shot(g2, "camera-hashtags");
  await tagPanel.getByRole("button", { name: "Done" }).click();
  await cam.getByRole("button", { name: "Add caption" }).click();
  await cam.getByRole("dialog", { name: "Write a caption" }).getByLabel("Caption").fill("With the happy couple!");
  await cam.getByRole("button", { name: "Done" }).click();
  await shot(g2, "camera-review");
  await cam.getByRole("button", { name: "Share" }).click();
  await expect(cam.getByAltText("Last shot")).toBeVisible();
  await cam.getByRole("button", { name: "Back to album" }).click();
  await expect(cam).toHaveCount(0);
  await g2.getByRole("button", { name: "Wishes" }).last().click();
  await g2.getByRole("textbox").fill("Selamat pengantin baru Aina & Hakim! Semoga bahagia hingga ke Jannah 🤍");
  await shot(g2, "guest-wish-sheet");
  await g2.getByRole("button", { name: "Send wish" }).click();
  await expect(g2.getByText("— Amir")).toBeVisible();
  await shot(g2, "guest-wishes", { bar: true });
  await g2.getByRole("navigation", { name: "Sections" }).getByRole("button", { name: "All Photos" }).click();
  await expect(g2.getByAltText("Photo by Siti")).toHaveCount(4, { timeout: 30_000 });
  for (const i of [0, 1]) {
    await g2.getByAltText("Photo by Siti").nth(i).click();
    await g2.getByRole("button", { name: "Heart this photo" }).click();
    if (i === 0) await shot(g2, "guest-viewer");
    await g2.getByRole("button", { name: "Close" }).click();
  }

  // ------------------------------------------------------------------ guest 1 browses everything
  await g1.reload();
  await expect(g1.getByRole("heading", { name: "Aina & Hakim's Wedding" })).toBeVisible();
  await shot(g1, "guest-home", { bar: true });
  await g1.getByRole("button", { name: "Highlights" }).click();
  await expect(g1.getByRole("button", { name: /#reception/ })).toBeVisible({ timeout: 30_000 });
  await shot(g1, "guest-highlights", { bar: true });
  await g1.getByRole("button", { name: /#reception/ }).click();
  await expect(g1.getByRole("heading", { name: "#reception" })).toBeVisible();
  await expect(g1.getByAltText("Photo by Siti")).toHaveCount(4, { timeout: 20_000 });
  await expect(g1.getByAltText("Photo by Amir")).toHaveCount(0);
  await shot(g1, "guest-hashtag-album", { bar: true });
  const tagged = await sql("select count(*)::int as n from photos where event_id = (select id from events where slug = $1) and 'bestday' = any(tags) and 'selfie' = any(tags)", [ev.slug]);
  expect(tagged[0].n).toBe(1);
  // Mission and hashtag filters at the API level (both once broke on a missing "$" in the SQL).
  const mis = await sql("select mission_id::text as id from photos where event_id = (select id from events where slug = $1) and mission_id is not null", [ev.slug]);
  for (const [q, n] of [[`mission=${mis[0].id}`, 1], ["tag=reception", 4], ["tag=bestday", 1]] as const) {
    const r = await g1.request.get(`/api/e/${ev.slug}/photos?order=new&${q}`);
    expect(r.ok(), q).toBe(true);
    expect(((await r.json()) as { photos: unknown[] }).photos, q).toHaveLength(n);
  }
  await g1.getByRole("button", { name: "People", exact: true }).click();
  await shot(g1, "guest-people", { bar: true });
  await g1.getByRole("button", { name: /Amir/ }).first().click();
  await expect(g1.getByRole("heading", { name: "Photos by Amir" })).toBeVisible();
  await shot(g1, "guest-person", { bar: true });
  await g1.getByRole("navigation", { name: "Sections" }).getByRole("button", { name: "All Photos" }).click();
  await g1.getByRole("combobox").selectOption("top");
  await shot(g1, "guest-all-most-loved", { bar: true });
  await g1.getByRole("button", { name: "More" }).click();
  await shot(g1, "guest-more");
  const [dl] = await Promise.all([g1.waitForEvent("download"), g1.getByRole("button", { name: "Share my story card" }).click()]);
  const card = `${OUT}/atoz-story-card.jpg`;
  await dl.saveAs(card);
  const meta = await sharp(card).metadata();
  expect([meta.width, meta.height]).toEqual([1080, 1920]);

  // ------------------------------------------------------------------ after the event: recap
  await sql("update events set starts_at = now() - interval '6 hours', ends_at = now() - interval '1 hour' where id = $1", [id]);
  await g1.reload();
  await expect(g1.getByText("The recap is ready")).toBeVisible();
  await g1.getByText("The recap is ready").click();
  await expect(g1.getByText("✨ The recap")).toBeVisible();
  await g1.waitForTimeout(1600);
  await shot(g1, "recap", { full: true });

  // ------------------------------------------------------------------ slideshow (TV)
  const tv = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  await tv.goto(`/e/${ev.slug}/slideshow`);
  await tv.waitForTimeout(3000);
  await shot(tv, "slideshow");
  await tv.close();

  // ------------------------------------------------------------------ admin
  for (const [name, p] of [
    ["admin-overview", "/admin"],
    ["admin-packages", "/admin/plans"],
    ["admin-addons", "/admin/plans?tab=addons"],
    ["admin-events", "/admin/events"],
    ["admin-event", `/admin/events/${id}`],
    ["admin-settings", "/admin/settings"],
    ["organiser-home", "/dashboard"],
    ["organiser-account", "/dashboard/account"],
  ]) {
    await o.goto(p);
    await shot(o, name);
  }

  // ------------------------------------------------------------------ delete
  await o.goto(`/dashboard/events/${id}/settings`);
  await o.locator('input[name="confirm"]').fill("Aina & Hakim's Wedding");
  await shot(o, "organiser-delete");

  writeFileSync(`${OUT}/atoz-problems.txt`, problems.join("\n") || "none");
  await org.close();
  await g1c.close();
  await g2c.close();
  expect(problems, problems.join("\n")).toEqual([]);
});
