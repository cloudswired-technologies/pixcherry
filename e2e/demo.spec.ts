import { expect, test, chromium, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, resolve } from "node:path";
import pg from "pg";
import sharp from "sharp";
import { asPhone } from "./phones";

// Showcase run with real photos, end to end: an organiser sets up a wedding album,
// six guests join (with selfies), upload, snap with PixCamera (the fake camera shows
// a real photo), caption, heart and write wishes; then the host dashboard, QR card,
// slideshow, recap and a second (corporate) event. Every step is asserted, and each
// screen is saved in high resolution for the landing page and the guide:
//   DEMO=1 npx playwright test e2e/demo.spec.ts   → docs/screens/demo/*.png
// Photos: e2e/.fixtures/photos/photo-01..24.jpg, cut from e2e/.fixtures/collage.png
// (a 4×6 photo collage) by scripts/split-collage.mjs.

test.skip(!process.env.DEMO, "set DEMO=1");

const DB = readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.*)$/m)![1].trim();
const OUT = "docs/screens/demo";
const PHOTOS = "e2e/.fixtures/photos";
const COLLAGE = "e2e/.fixtures/collage.png";
const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true };
const DESK = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 };
const CAMERA_ARGS = ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"];

async function sql(text: string, params: unknown[] = []) {
  const c = new pg.Client({ connectionString: DB });
  await c.connect();
  try {
    return (await c.query(text, params)).rows;
  } finally {
    await c.end();
  }
}

const photo = (n: number) => join(PHOTOS, `photo-${String(n).padStart(2, "0")}.jpg`);
const files = (ns: number[]) => ns.map((n) => ({ name: `IMG_${2400 + n}.jpg`, mimeType: "image/jpeg", buffer: readFileSync(photo(n)) }));

/** A square "selfie" cut around the most interesting part of a photo. */
async function selfie(n: number) {
  return { name: `selfie-${n}.jpg`, mimeType: "image/jpeg", buffer: await sharp(photo(n)).resize(600, 600, { fit: "cover", position: sharp.strategy.attention }).jpeg({ quality: 90 }).toBuffer() };
}

/** Fake camera feed: Chromium plays an .mjpeg file (here one real photo) as the webcam. */
async function cameraFeed(n: number) {
  const f = resolve(OUT, `..`, `camera-${n}.mjpeg`);
  writeFileSync(f, await sharp(photo(n)).resize(1280, 960, { fit: "cover" }).jpeg({ quality: 92 }).toBuffer());
  return f;
}

let shots = 0;
async function shot(page: Page, name: string, opts: { full?: boolean } = {}) {
  await page.waitForTimeout(500);
  await page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 15_000 }).catch(() => {});
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(wide, `${name}: sideways scroll`).toBeLessThanOrEqual(1);
  shots++;
  await page.screenshot({ path: `${OUT}/${String(shots).padStart(2, "0")}-${name}.png`, fullPage: !!opts.full });
}

async function login(page: Page, email: string) {
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a code" }).click();
  await page.getByLabel("Login code").fill("123456");
  await page.getByRole("button", { name: "Log in" }).click();
}

let phoneId = 7000;
/** A guest on their own phone; `camera` = which photo their camera "sees". */
async function guest(browsers: Browser[], slug: string, camera?: number): Promise<{ ctx: BrowserContext; page: Page }> {
  let b: Browser;
  if (camera) {
    b = await chromium.launch({ channel: "msedge", args: [...CAMERA_ARGS, `--use-file-for-fake-video-capture=${await cameraFeed(camera)}`] });
    browsers.push(b);
  } else b = browsers[0];
  const ctx = await b.newContext({ ...PHONE, baseURL: "http://localhost:3000", permissions: ["camera"] });
  await asPhone(ctx, ++phoneId);
  await ctx.addInitScript((s) => {
    localStorage.setItem(`pc-install-${s}`, "1");
    Object.defineProperty(navigator, "canShare", { value: undefined });
  }, slug);
  const page = await ctx.newPage();
  await page.goto(`/e/${slug}`);
  return { ctx, page };
}

async function joinAlbum(page: Page, name: string, face: number) {
  await expect(page.getByRole("dialog", { name: "Join the album" })).toBeVisible();
  await page.getByLabel("Your name").fill(name);
  await page.locator('input[capture="user"]').first().setInputFiles(await selfie(face));
  await expect(page.getByRole("button", { name: "Add a selfie (optional)" }).locator("img")).toBeVisible();
}

async function share(page: Page, ns: number[], tag: string) {
  await page.locator("input[type=file][multiple]").setInputFiles(files(ns));
  const review = page.getByRole("dialog", { name: "Ready to share?" });
  await expect(review).toBeVisible();
  await review.getByRole("button", { name: `#${tag}` }).click();
  await page.getByRole("button", { name: new RegExp(`Share ${ns.length} photo`) }).click();
  await expect(page.getByRole("status")).toContainText(/shared/i, { timeout: 90_000 });
}

test("showcase: wedding album end to end with real photos", async ({ browser }) => {
  test.setTimeout(1_200_000);
  mkdirSync(OUT, { recursive: true });
  if (!existsSync(PHOTOS) || readdirSync(PHOTOS).length < 24) execFileSync("node", ["scripts/split-collage.mjs", COLLAGE, PHOTOS, "3"], { stdio: "inherit" });
  const browsers: Browser[] = [browser];
  // Compile the routes a join touches up front (the dev server compiles on first use).
  for (const r of ["avatar", "uploads", "photos/00000000-0000-0000-0000-000000000000/report"]) await browser.newPage().then(async (p) => { await p.request.post(`http://localhost:3000/api/e/no-such-event/${r}`, { timeout: 120_000 }).catch(() => {}); await p.close(); });
  const tag = Date.now().toString(36);

  // ------------------------------------------------------------------ landing + organiser setup (desktop)
  const deskCtx = await browser.newContext(DESK);
  const d = await deskCtx.newPage();
  await d.goto("/");
  await shot(d, "landing-desktop");
  await d.goto("/dashboard/events/new?plan=exclusive");
  await login(d, "admin@example.com");
  await expect(d.getByRole("heading", { name: "Create your event" })).toBeVisible();
  await d.getByLabel("Event name").fill("Aina & Hakim's Wedding");
  await d.getByLabel("Event link").fill(`aina-hakim-${tag}`);
  await expect(d.getByLabel("Available")).toBeVisible();
  await d.getByLabel("Venue (optional)").fill("The Glasshouse, Seputeh");
  await d.getByLabel("Message for guests (optional)").fill("Thank you for celebrating with us! Snap away and share every moment 🤍");
  await shot(d, "create-event-desktop");
  await d.getByRole("button", { name: "Continue to package" }).click();
  await expect(d.getByRole("heading", { name: "Choose a package" })).toBeVisible();
  await shot(d, "checkout-desktop", { full: true });
  const id = d.url().split("/events/")[1].split("/")[0];
  // Pay with a 100% promo code (no CHIP in tests).
  await sql("insert into promo_codes (code, percent_off) values ('DEMOFREE', 100) on conflict (code) do update set is_active = true, used_count = 0");
  const exclusive = d.locator("div.rounded-3xl", { hasText: "Exclusive" }).first();
  await exclusive.getByLabel("Promo code (optional)").fill("demofree");
  await exclusive.getByRole("button", { name: /^Pay RM/ }).click();
  await expect(d.getByRole("heading", { name: "You're all set" })).toBeVisible();
  await shot(d, "paid-desktop");
  const [ev] = await sql("select slug, plan_snapshot->>'code' as plan from events where id = $1", [id]);
  expect(ev.plan).toBe("exclusive");
  // The event is happening now (started an hour ago, ends tonight).
  await sql("update events set starts_at = now() - interval '1 hour', ends_at = now() + interval '5 hours' where id = $1", [id]);

  // Cover photo, missions, hashtags.
  await d.goto(`/dashboard/events/${id}/settings`);
  await d.locator('input[name="cover"]').setInputFiles(files([2])[0]);
  await d.getByRole("button", { name: "Upload cover" }).click();
  await expect(d.locator('img[src*="cover.webp"]').first()).toBeVisible({ timeout: 30_000 });
  await d.goto(`/dashboard/events/${id}/engage`);
  for (const idea of ["Selfie with the host", "Big group photo", "A big candid laugh", "The food you loved"]) {
    await d.getByRole("button", { name: `Add idea: ${idea}` }).click();
    await expect(d.getByRole("button", { name: `Add idea: ${idea}` })).toHaveCount(0);
  }
  await shot(d, "missions-desktop");
  await d.goto(`/dashboard/events/${id}/qr`);
  await expect(d.getByAltText("QR card guests scan to join the album")).toBeVisible();
  await shot(d, "qr-desktop");

  // ------------------------------------------------------------------ guests (phones)
  const slug = ev.slug as string;
  // Siti: first visit, joins with a selfie, uploads from the gallery.
  const siti = await guest(browsers, slug);
  await shot(siti.page, "guest-first-visit");
  await siti.page.getByRole("button", { name: "Upload" }).click();
  await joinAlbum(siti.page, "Siti", 21);
  await shot(siti.page, "guest-join");
  await siti.page.getByRole("button", { name: /Let's go/ }).click();
  await expect(siti.page.getByText(/You have\s*\d+\s*shots left/)).toBeVisible({ timeout: 90_000 });
  await siti.page.locator("input[type=file][multiple]").setInputFiles(files([1, 4]));
  await expect(siti.page.getByRole("dialog", { name: "Ready to share?" })).toBeVisible();
  await siti.page.getByRole("dialog", { name: "Ready to share?" }).getByRole("button", { name: "#ceremony" }).click();
  await shot(siti.page, "guest-upload-review");
  await siti.page.getByRole("button", { name: /Share 2 photos/ }).click();
  await expect(siti.page.getByRole("status")).toContainText(/shared/i, { timeout: 90_000 });

  // Amir: snaps with PixCamera (his camera sees the toast), hashtag + film look + caption.
  const amir = await guest(browsers, slug, 24);
  await amir.page.getByRole("navigation", { name: "Actions" }).getByRole("button", { name: "Snap" }).click();
  await joinAlbum(amir.page, "Amir", 9);
  await amir.page.getByRole("button", { name: /Let's go/ }).click();
  const cam = amir.page.getByRole("dialog", { name: "Camera" });
  await expect(cam.getByRole("button", { name: "Take photo" })).toBeEnabled({ timeout: 20_000 });
  await cam.getByRole("button", { name: "Kodak Gold" }).click();
  await amir.page.waitForTimeout(800);
  await shot(amir.page, "camera-kodak-gold");
  await cam.getByRole("button", { name: "Take photo" }).click();
  await expect(cam.getByAltText("Your photo")).toBeVisible();
  await cam.getByRole("button", { name: "Hashtags" }).click();
  const tags = cam.getByRole("dialog", { name: "Add hashtags" });
  await tags.getByRole("button", { name: "#reception" }).click();
  await tags.getByRole("button", { name: "Done" }).click();
  await cam.getByRole("button", { name: "Add caption" }).click();
  await cam.getByRole("dialog", { name: "Write a caption" }).getByLabel("Caption").fill("Cheers to the newlyweds! 🥂");
  await cam.getByRole("button", { name: "Done" }).click();
  await shot(amir.page, "camera-review");
  await cam.getByRole("button", { name: "Share" }).click();
  await expect(cam.getByAltText("Last shot")).toBeVisible();
  await cam.getByRole("button", { name: "Back to album" }).click();
  await expect(cam).toHaveCount(0);

  // Mei Ling, Raj, Farah, Daniel: gallery uploads with hashtags.
  const people: [string, number, number[], string][] = [
    ["Mei Ling", 11, [8], "reception"],
    ["Raj", 16, [20], "food"],
    ["Farah", 13, [22], "friends"],
    ["Daniel", 14, [2], "ceremony"],
  ];
  const pages: Record<string, Page> = { Siti: siti.page, Amir: amir.page };
  for (const [name, face, ns, t] of people) {
    const g = await guest(browsers, slug);
    await g.page.getByRole("button", { name: "Upload" }).click();
    await joinAlbum(g.page, name, face);
    await g.page.getByRole("button", { name: /Let's go/ }).click();
    await expect(g.page.getByText(/You have\s*\d+\s*shots left/)).toBeVisible({ timeout: 90_000 });
    await share(g.page, ns, t);
    pages[name] = g.page;
  }
  const ready = async () => (await sql("select count(*)::int n from photos where event_id = $1 and status = 'ready'", [id]))[0].n as number;
  await expect.poll(ready, { timeout: 120_000 }).toBe(7);
  // The AI check ran on every photo and hid none of these.
  const ai = await sql("select count(*)::int n, count(*) filter (where nsfw is null)::int unchecked, count(*) filter (where flag = 'ai')::int hidden from photos where event_id = $1", [id]);
  expect(ai[0]).toMatchObject({ n: 7, unchecked: 0, hidden: 0 });

  // Captions on own photos, hearts, wishes.
  const sitiPage = pages.Siti;
  await sitiPage.reload();
  await sitiPage.getByRole("navigation", { name: "Sections" }).getByRole("button", { name: "All Photos" }).click();
  await sitiPage.getByAltText("Photo by Siti").filter({ visible: true }).first().click();
  await sitiPage.getByRole("button", { name: "Add a caption" }).click();
  await sitiPage.getByRole("textbox", { name: "Caption" }).fill("Officially Mr & Mrs! 💍");
  await sitiPage.getByRole("button", { name: "Save caption" }).click();
  await expect(sitiPage.getByRole("dialog", { name: "Photo" }).getByText("Officially Mr & Mrs! 💍")).toBeVisible();
  await sitiPage.getByRole("button", { name: "Close" }).click();
  const wishes: [string, string][] = [
    ["Mei Ling", "Congratulations Aina & Hakim! Wishing you a lifetime of love and laughter 🥂"],
    ["Raj", "Selamat pengantin baru! The food was amazing, thank you for having us."],
    ["Farah", "Semoga bahagia hingga ke Jannah, Aina & Hakim 🤍"],
  ];
  for (const [name, text] of wishes) {
    const p = pages[name];
    await p.getByRole("button", { name: "Wishes" }).last().click();
    await p.getByRole("textbox").fill(text);
    await p.getByRole("button", { name: "Send wish" }).click();
    await expect(p.getByText(`— ${name}`)).toBeVisible();
  }
  // Hearts from several guests (votes are per guest).
  for (const [name, n] of [["Mei Ling", 3], ["Raj", 2], ["Farah", 3], ["Daniel", 2], ["Siti", 1]] as const) {
    const p = pages[name];
    await p.reload();
    await p.getByRole("navigation", { name: "Sections" }).getByRole("button", { name: "All Photos" }).click();
    for (let i = 0; i < n; i++) {
      await p.locator("main img[alt^='Photo by']").filter({ visible: true }).nth(i).click();
      const heart = p.getByRole("button", { name: "Heart this photo" });
      if (await heart.isVisible().catch(() => false)) await heart.click();
      await p.getByRole("button", { name: "Close" }).click();
    }
  }

  // ------------------------------------------------------------------ guest screens to show off
  const m = pages["Mei Ling"];
  await m.reload();
  await expect(m.getByRole("heading", { name: "Aina & Hakim's Wedding" })).toBeVisible();
  await shot(m, "guest-home");
  await m.getByRole("button", { name: "Highlights" }).click();
  await expect(m.getByText("Best moments")).toBeVisible({ timeout: 30_000 });
  await shot(m, "guest-highlights");
  await m.getByRole("button", { name: "People", exact: true }).click();
  await shot(m, "guest-people");
  await m.getByRole("navigation", { name: "Sections" }).getByRole("button", { name: "All Photos" }).click();
  await shot(m, "guest-all-photos");
  await m.getByAltText("Photo by Siti").filter({ visible: true }).first().click();
  await expect(m.getByRole("dialog", { name: "Photo" })).toBeVisible();
  await shot(m, "guest-viewer");
  await m.getByRole("button", { name: "Close" }).click();
  await m.getByRole("button", { name: "Missions", exact: true }).click();
  await shot(m, "guest-missions");
  await m.getByRole("button", { name: "Wishes" }).first().click();
  await expect(m.getByText("— Raj").first()).toBeVisible({ timeout: 30_000 });
  await shot(m, "guest-wishes");

  // ------------------------------------------------------------------ host dashboard
  await d.goto(`/dashboard/events/${id}`);
  await expect(d.getByRole("heading", { name: "Aina & Hakim's Wedding" })).toBeVisible();
  await shot(d, "host-overview-desktop");
  // Folded "Getting started": the KPIs and latest photos, as a host sees it mid-event.
  const guide = d.getByRole("region", { name: "Getting started" }).getByRole("button", { expanded: true });
  if (await guide.count()) await guide.first().click();
  await shot(d, "host-overview-live-desktop");
  await d.goto(`/dashboard/events/${id}/photos`);
  await shot(d, "host-photos-desktop");
  await d.goto(`/dashboard/events/${id}/guests`);
  await shot(d, "host-guests-desktop");
  await d.goto(`/dashboard/events/${id}/wishes`);
  await shot(d, "host-wishes-desktop");
  const hostPhoneCtx = await browser.newContext({ ...PHONE, storageState: await deskCtx.storageState() });
  const hp = await hostPhoneCtx.newPage();
  await hp.goto(`/dashboard/events/${id}`);
  await shot(hp, "host-overview-phone");
  await hp.goto(`/dashboard/events/${id}/photos`);
  await shot(hp, "host-photos-phone");

  // ------------------------------------------------------------------ slideshow on a TV
  const tv = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await tv.goto(`/e/${slug}/slideshow`);
  await expect(tv.getByText("Waiting for the first photo…")).toHaveCount(0, { timeout: 30_000 });
  await tv.waitForTimeout(4000);
  await shot(tv, "slideshow-tv");
  await tv.waitForTimeout(6000);
  await shot(tv, "slideshow-tv-2");
  await tv.close();

  // ------------------------------------------------------------------ after the event: recap + download
  await sql("update events set starts_at = now() - interval '7 hours', ends_at = now() - interval '1 hour' where id = $1", [id]);
  await m.reload();
  await expect(m.getByText("The recap is ready")).toBeVisible();
  await m.getByRole("link", { name: /The recap is ready/ }).click();
  await expect(m.getByText("✨ The recap")).toBeVisible({ timeout: 120_000 });
  await m.waitForTimeout(1800);
  await shot(m, "recap", { full: true });
  const zip = await d.request.get(`/api/e/${slug}/album`);
  expect(zip.status()).toBe(200);
  expect((await zip.body()).subarray(0, 2).toString()).toBe("PK");

  // ------------------------------------------------------------------ a corporate event: same app, different crowd
  await d.goto("/dashboard/events/new?plan=premium");
  await d.getByLabel("Event name").fill("TechConnect Summit 2026");
  await d.getByLabel("Event link").fill(`techconnect-${tag}`);
  await expect(d.getByLabel("Available")).toBeVisible();
  await d.getByLabel("Venue (optional)").fill("KL Convention Centre");
  await d.getByRole("button", { name: "Continue to package" }).click();
  const prem = d.locator("div.rounded-3xl", { hasText: "Premium" }).first();
  await prem.getByLabel("Promo code (optional)").fill("demofree");
  await prem.getByRole("button", { name: /^Pay RM/ }).click();
  await expect(d.getByRole("heading", { name: "You're all set" })).toBeVisible();
  const [corp] = await sql("select id, slug from events where slug = $1", [`techconnect-${tag}`]);
  await sql("update events set starts_at = now() - interval '2 hours', ends_at = now() + interval '6 hours' where id = $1", [corp.id]);
  for (const [name, face, ns, t] of [
    ["Hana", 13, [9, 10, 15], "reception"],
    ["Kumar", 16, [11, 12, 14, 16], "friends"],
  ] as const) {
    const g = await guest(browsers, corp.slug);
    await g.page.getByRole("button", { name: "Upload" }).click();
    await joinAlbum(g.page, name, face);
    await g.page.getByRole("button", { name: /Let's go/ }).click();
    await share(g.page, [...ns], t);
    pages[name] = g.page;
  }
  await expect.poll(async () => (await sql("select count(*)::int n from photos where event_id = $1 and status = 'ready'", [corp.id]))[0].n, { timeout: 120_000 }).toBe(7);
  const k = pages.Kumar;
  await k.reload();
  await k.getByRole("navigation", { name: "Sections" }).getByRole("button", { name: "All Photos" }).click();
  await shot(k, "corporate-all-photos");
  const tv2 = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await tv2.goto(`/e/${corp.slug}/slideshow`);
  await expect(tv2.getByText("Waiting for the first photo…")).toHaveCount(0, { timeout: 30_000 });
  await tv2.waitForTimeout(5000);
  await shot(tv2, "corporate-slideshow-tv");
  await tv2.close();

  writeFileSync(`${OUT}/events.json`, JSON.stringify({ wedding: { id, slug }, corporate: corp }, null, 2));
  for (const b of browsers.slice(1)) await b.close().catch(() => {});
});
