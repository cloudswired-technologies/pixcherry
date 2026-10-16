import { expect, test, type Page } from "@playwright/test";
import { asPhone, distinctPhones } from "./phones";
import { readFileSync } from "node:fs";
import pg from "pg";
import sharp from "sharp";

// Round 4: memorable event links (+ rename redirect, find page), uploading
// tiles, captions (own photos, written on downloads), Missions tab with Mission Master badge,
// Top Snappers tab, Snap (phone camera + develop), QR / slideshow / install in More, "You" chip,
// and the home-screen app's signed start link.

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

/** A guest who has already seen (and closed) the "add to home screen" guide. */
async function seenInstall(page: Page, slug: string) {
  await page.addInitScript((s) => localStorage.setItem(`pc-install-${s}`, "1"), slug);
}

async function login(page: Page, email: string) {
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a code" }).click();
  await page.getByLabel("Login code").fill("123456");
  await page.getByRole("button", { name: "Log in" }).click();
}

const jpeg = (color: string) => sharp({ create: { width: 900, height: 1200, channels: 3, background: color } }).jpeg().toBuffer();

test("links, captions, missions, top snappers, snap, install", async ({ browser, page }) => {
  distinctPhones(browser);
  test.setTimeout(300_000);
  const tag = Date.now().toString(36);
  const email = `social-${tag}@example.com`;
  await sql("insert into users (email) values ($1)", [email]);

  // ---------------------------------------------------------------- organiser: memorable link
  await page.goto("/dashboard/events/new");
  await login(page, email);
  await page.getByLabel("Event name").fill("Aina & Hakim's Wedding");
  await expect(page.getByLabel("Event link")).toHaveValue("aina-hakims-wedding");
  const wanted = `aina-hakim-${tag}`;
  await page.getByLabel("Event link").fill(wanted);
  await expect(page.getByLabel("Available")).toBeVisible();
  await page.getByRole("button", { name: "Continue to package" }).click();
  await expect(page.getByRole("heading", { name: "Choose a package" })).toBeVisible();
  const [ev] = await sql("select id, slug from events where slug = $1", [wanted]);
  expect(ev).toBeTruthy();
  // Reserved words and taken links are refused live.
  await sql(
    `update events e set paid_at = now(), deletion_at = now() + interval '9 days', plan_id = p.id,
       plan_snapshot = jsonb_build_object('code', p.code, 'name', p.name, 'price_cents', p.price_cents, 'limits', p.limits,
         'features', p.features || '{"missions":true,"slideshow":true,"voting":true,"camera":true}'::jsonb,
         'quality', json_build_object('name', q.name, 'max_px', q.max_px, 'jpeg_quality', q.jpeg_quality))
     from plans p join quality_presets q on q.id = p.quality_preset_id where p.code = 'basic' and e.id = $1`,
    [ev.id],
  );
  await sql("insert into event_missions (event_id, title, emoji, sort) values ($1, 'A really long mission title so we can check it is shown in full', '🎯', 1)", [ev.id]);

  // Rename the link: the old one keeps working.
  await page.goto(`/dashboard/events/${ev.id}/settings`);
  await page.getByLabel("Event link").fill("admin");
  await expect(page.getByText("That word is reserved. Try another.")).toBeVisible();
  const renamed = `ah-${tag}`;
  await page.getByLabel("Event link").fill(renamed);
  await expect(page.getByLabel("Available")).toBeVisible();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  const [after] = await sql("select slug, old_slugs from events where id = $1", [ev.id]);
  expect(after.slug).toBe(renamed);
  expect(after.old_slugs).toEqual([wanted]);
  const slug = renamed;

  // ---------------------------------------------------------------- guest 1: old link, find page, join, You chip
  const c1 = await browser.newContext({ ...PHONE, permissions: ["camera"] });
  await asPhone(c1, 4242); // the same "phone" comes back later in another browser
  const g1 = await c1.newPage();
  await g1.goto(`/e/${wanted}`);
  await expect(g1).toHaveURL(new RegExp(`/e/${slug}$`));
  await g1.goto(`/find?q=${encodeURIComponent(`https://app.example.com/${slug.toUpperCase()}`)}`);
  await expect(g1).toHaveURL(new RegExp(`/e/${slug}$`));
  await g1.goto("/find?q=no-such-event-here");
  await expect(g1.getByText("We couldn't find “no-such-event-here”")).toBeVisible();
  await g1.goto(`/e/${slug}`);
  // Missions tab shows the full title.
  await g1.getByRole("button", { name: "Missions", exact: true }).click();
  await expect(g1.getByRole("heading", { name: "A really long mission title so we can check it is shown in full" })).toBeVisible();
  await g1.getByRole("button", { name: "Join", exact: true }).click();
  await g1.getByLabel("Your name").fill("Siti");
  await g1.getByRole("button", { name: /Let's go/ }).click();
  await expect(g1.getByRole("button", { name: "You: Siti" })).toBeVisible();
  // The install guide pops up on a phone after joining; dismiss it.
  const install = g1.getByRole("dialog", { name: "📲 Keep this album on your phone" });
  await expect(install).toBeVisible({ timeout: 10_000 });
  await install.getByRole("button", { name: "Not now" }).click();
  // Rename from the You sheet.
  await g1.getByRole("button", { name: "You: Siti" }).click();
  await g1.getByRole("button", { name: "Edit name" }).click();
  await g1.getByLabel("Your name").fill("Siti Aminah");
  await g1.getByRole("button", { name: "Save" }).click();
  await expect(g1.getByRole("button", { name: "You: Siti Aminah" })).toBeVisible();
  await g1.getByRole("dialog", { name: "You" }).getByRole("button", { name: "Close" }).click();

  // ---------------------------------------------------------------- uploading tiles appear at once
  await g1.locator("input[type=file][multiple]").setInputFiles([
    { name: "a.jpg", mimeType: "image/jpeg", buffer: await jpeg("#e94f6a") },
    { name: "b.jpg", mimeType: "image/jpeg", buffer: await jpeg("#3d8be8") },
  ]);
  await g1.getByRole("button", { name: /Share 2 photos/ }).click();
  await expect(g1.locator('[aria-busy="true"]').first()).toBeVisible({ timeout: 2_000 });
  await expect(g1.getByAltText("Photo by Siti Aminah")).toHaveCount(2, { timeout: 60_000 });
  await expect(g1.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 15_000 });

  // ---------------------------------------------------------------- Snap: PixCamera (mission), then the camera roll
  await g1.getByRole("button", { name: "Missions", exact: true }).click();
  await g1.getByRole("button", { name: "Snap it" }).click();
  const cam = g1.getByRole("dialog", { name: "Camera" });
  await expect(cam.getByRole("button", { name: "Take photo" })).toBeEnabled({ timeout: 15_000 });
  await cam.getByRole("button", { name: "Take photo" }).click();
  await cam.getByRole("button", { name: "Share" }).click();
  await cam.getByRole("button", { name: "Open your shots" }).click();
  const roll = cam.getByRole("dialog", { name: "Your shots" });
  await expect(roll.getByText("1 of 1")).toBeVisible();
  await roll.getByRole("button", { name: "Back to camera" }).click();
  await expect(roll).toHaveCount(0);
  await expect(cam).toBeVisible(); // back from the roll stays in the camera
  await cam.getByRole("button", { name: "Back to album" }).click();
  await expect(cam).toHaveCount(0);
  // Only mission done -> Mission Master.
  await g1.getByRole("button", { name: "Missions", exact: true }).click();
  await expect(g1.getByRole("heading", { name: "Mission Master!" })).toBeVisible({ timeout: 60_000 });
  await expect(g1.getByRole("button", { name: "You: Siti Aminah" })).toContainText("🏆");
  await expect(g1.getByText("⚡ Fastest")).toBeVisible({ timeout: 35_000 });

  // ---------------------------------------------------------------- captions (own photo), zoom
  await g1.getByRole("navigation", { name: "Sections" }).getByRole("button", { name: "All Photos" }).click();
  await expect(g1.getByAltText("Photo by Siti Aminah")).toHaveCount(3, { timeout: 60_000 });
  await g1.getByAltText("Photo by Siti Aminah").first().click();
  await g1.getByRole("button", { name: "Zoom in" }).click();
  await expect(g1.locator('[data-zoomed="true"] img')).toHaveAttribute("src", /full.jpg/); // zooms in place, full file
  await g1.getByRole("button", { name: "Zoom out" }).click();
  await g1.getByRole("button", { name: "Add a caption" }).click();
  await g1.getByRole("textbox", { name: "Caption" }).fill("So pretty! 😍");
  await g1.getByRole("button", { name: "Save caption" }).click();
  await expect(g1.getByRole("dialog", { name: "Photo" }).getByText("So pretty! 😍")).toBeVisible();
  await g1.getByRole("button", { name: "Close" }).click();
  const [cap] = await sql("select id, height from photos where event_id = $1 and caption = 'So pretty! 😍'", [ev.id]);
  expect(cap).toBeTruthy();
  const dl = await g1.request.get(`/api/e/${slug}/photos/${cap.id}/download`);
  expect((await sharp(await dl.body()).metadata()).height!).toBeGreaterThan(cap.height);

  // Guest 2 sees the caption but can't edit someone else's photo; then joins as Nora.
  const c2 = await browser.newContext(PHONE);
  const g2 = await c2.newPage();
  await seenInstall(g2, slug);
  await g2.goto(`/e/${slug}`);
  await g2.getByRole("navigation", { name: "Sections" }).getByRole("button", { name: "All Photos" }).click();
  await g2.getByAltText("Photo by Siti Aminah").first().click();
  await expect(g2.getByRole("dialog", { name: "Photo" }).getByText("So pretty! 😍")).toBeVisible();
  await expect(g2.getByRole("button", { name: "Add a caption" })).toHaveCount(0);
  await expect(g2.getByRole("button", { name: "Edit caption" })).toHaveCount(0);
  await g2.getByRole("button", { name: "Close" }).click();
  await g2.getByRole("button", { name: "Join", exact: true }).click();
  await g2.getByLabel("Your name").fill("Nora");
  await g2.getByRole("button", { name: /Let's go/ }).click();
  await expect(g2.getByRole("button", { name: "You: Nora" })).toBeVisible();

  // ---------------------------------------------------------------- Top Snappers + More menu
  await g2.goto(`/e/${slug}`);
  await g2.getByRole("button", { name: "Top Snappers" }).click();
  await expect(g2.getByRole("heading", { name: "🏆 Top Snappers" })).toBeVisible();
  await expect(g2.getByRole("main").getByText("Siti Aminah")).toBeVisible();
  await g2.getByRole("button", { name: "More" }).click();
  await expect(g2.getByRole("link", { name: "Play slideshow" })).toHaveAttribute("href", `/e/${slug}/slideshow`);
  await g2.getByRole("button", { name: "Show QR code" }).click();
  await expect(g2.getByRole("dialog", { name: "Scan to join" }).locator("svg").first()).toBeVisible();

  // ---------------------------------------------------------------- home-screen app start link
  const key = await g1.evaluate(() => document.querySelector('link[rel="manifest"]')?.getAttribute("href") ?? "");
  expect(key).toContain("manifest.webmanifest?k=");
  const manifest = await (await g1.request.get(key)).json();
  expect(manifest.name).toBe("Aina & Hakim's Wedding");
  expect(manifest.start_url).toContain(`/e/${slug}/resume?k=`);
  // A brand-new browser (like the installed app on iOS) opens the start link and is Siti.
  const c3 = await browser.newContext(PHONE);
  const g3 = await c3.newPage();
  await seenInstall(g3, slug);
  await g3.goto(manifest.start_url);
  await expect(g3).toHaveURL(new RegExp(`/e/${slug}$`));
  await expect(g3.getByRole("button", { name: "You: Siti Aminah" })).toBeVisible();
  // A forged key gets nothing.
  const c4 = await browser.newContext(PHONE);
  const g4 = await c4.newPage();
  await seenInstall(g4, slug);
  await g4.goto(`/e/${slug}/resume?k=${encodeURIComponent(key.split("k=")[1].slice(0, -6) + "AAAAAA")}`);
  await expect(g4.getByRole("button", { name: "Join", exact: true })).toBeVisible();

  // ---------------------------------------------------------------- same phone, another browser ("two Yayas" bug)
  const c5 = await browser.newContext(PHONE);
  const g5 = await c5.newPage();
  await seenInstall(g5, slug);
  await g5.goto(`/e/${slug}`);
  await g5.getByRole("button", { name: "Join", exact: true }).click();
  await g5.getByLabel("Your name").fill("siti aminah");
  await g5.getByRole("button", { name: /Let's go/ }).click();
  const back = g5.getByRole("group", { name: "Welcome back" });
  await expect(back).toContainText("Welcome back, Siti Aminah!");
  await back.getByRole("button", { name: "Yes, continue as Siti Aminah" }).click();
  await expect(g5.getByRole("button", { name: "You: Siti Aminah" })).toBeVisible();
  const sitis = await sql("select id from guests where event_id = $1 and lower(name) = 'siti aminah'", [ev.id]);
  expect(sitis).toHaveLength(1);
  // The first browser is still signed in too.
  await g1.reload();
  await expect(g1.getByRole("button", { name: "You: Siti Aminah" })).toBeVisible();
  // "No, I'm someone else" → names are unique, so they pick another one ("Nora 2").
  const c6 = await browser.newContext(PHONE);
  const g6 = await c6.newPage();
  await seenInstall(g6, slug);
  await g6.goto(`/e/${slug}`);
  await g6.getByRole("button", { name: "Join", exact: true }).click();
  await g6.getByLabel("Your name").fill("Nora");
  await g6.getByRole("button", { name: /Let's go/ }).click();
  await g6.getByRole("group", { name: "Welcome back" }).getByRole("button", { name: "No, I'm someone else" }).click();
  await expect(g6.getByRole("alert").filter({ hasText: "Someone here is already called Nora" })).toBeVisible();
  await g6.getByRole("button", { name: "Use “Nora 2”" }).click();
  await expect(g6.getByLabel("Your name")).toHaveValue("Nora 2");
  await g6.getByRole("button", { name: /Let's go/ }).click();
  await expect(g6.getByRole("button", { name: "You: Nora 2" })).toBeVisible();
  expect(await sql("select name from guests where event_id = $1 and name like 'Nora%' order by name", [ev.id])).toEqual([{ name: "Nora" }, { name: "Nora 2" }]);
  // Renaming to a taken name is refused too.
  await g6.getByRole("button", { name: "You: Nora 2" }).click();
  await g6.getByRole("button", { name: "Edit name" }).click();
  await g6.getByLabel("Your name").fill("siti aminah");
  await g6.getByRole("button", { name: "Save" }).click();
  await expect(g6.getByRole("alert").filter({ hasText: "Someone here is already called siti aminah" })).toBeVisible();
  await g6.getByRole("dialog", { name: "You" }).getByRole("button", { name: "Close" }).click();
  // Someone else's upload in progress shows as a tile on this phone.
  const [siti] = await sql("select id from guests where event_id = $1 and name = 'Siti Aminah'", [ev.id]);
  const [fake] = await sql("insert into photos (event_id, guest_id, content_type, declared_bytes) values ($1, $2, 'image/jpeg', 1000) returning id", [ev.id, siti.id]);
  await g6.getByRole("navigation", { name: "Sections" }).getByRole("button", { name: "All Photos" }).click();
  await expect(g6.getByText("Siti Aminah is sharing…").first()).toBeVisible({ timeout: 15_000 });
  await sql("delete from photos where id = $1", [fake.id]);
  await expect(g6.getByText("Siti Aminah is sharing…")).toHaveCount(0, { timeout: 15_000 });

  // ---------------------------------------------------------------- one phone, one roll (device + network)
  // Siti's phone in yet another browser, typing a different name: strict mode keeps her roll.
  const c7 = await browser.newContext(PHONE);
  await asPhone(c7, 4242);
  const g7 = await c7.newPage();
  await seenInstall(g7, slug);
  await g7.goto(`/e/${slug}`);
  await g7.getByRole("button", { name: "Join", exact: true }).click();
  await g7.getByLabel("Your name").fill("Ali");
  await g7.getByRole("button", { name: /Let's go/ }).click();
  const strict = g7.getByRole("group", { name: "Welcome back" });
  await expect(strict).toContainText("This phone is already in the album as Siti Aminah");
  await expect(strict.getByRole("button", { name: "No, I'm someone else" })).toHaveCount(0);
  await strict.getByRole("button", { name: "Continue as Siti Aminah" }).click();
  await expect(g7.getByRole("button", { name: "You: Siti Aminah" })).toBeVisible();
  // Organiser turned strict off: "someone else" is allowed but flagged for review.
  await sql("update events set one_phone_one_roll = false where id = $1", [ev.id]);
  const c8 = await browser.newContext(PHONE);
  await asPhone(c8, 4242);
  const g8 = await c8.newPage();
  await seenInstall(g8, slug);
  await g8.goto(`/e/${slug}`);
  await g8.getByRole("button", { name: "Join", exact: true }).click();
  await g8.getByLabel("Your name").fill("Ali");
  await g8.getByRole("button", { name: /Let's go/ }).click();
  await g8.getByRole("group", { name: "Welcome back" }).getByRole("button", { name: "No, I'm someone else" }).click();
  await expect(g8.getByRole("button", { name: "You: Ali" })).toBeVisible();
  const [ali] = await sql("select g.same_phone_as = s.id as flagged from guests g, guests s where g.event_id = $1 and g.name = 'Ali' and s.event_id = $1 and s.name = 'Siti Aminah'", [ev.id]);
  expect(ali.flagged).toBe(true);
  await sql("update events set one_phone_one_roll = true where id = $1", [ev.id]);

  // Same phone hours later on another network (Chrome then Edge, IP changed): asked, not silently a new guest.
  const c9 = await browser.newContext({ ...PHONE, extraHTTPHeaders: { "cf-connecting-ip": "203.0.113.5" } });
  await asPhone(c9, 4242);
  const g9 = await c9.newPage();
  await seenInstall(g9, slug);
  await g9.goto(`/e/${slug}`);
  await g9.getByRole("button", { name: "Join", exact: true }).click();
  await g9.getByLabel("Your name").fill("Yaya");
  await g9.getByRole("button", { name: /Let's go/ }).click();
  const ask = g9.getByRole("group", { name: "Welcome back" });
  await expect(ask).toContainText("This phone already joined");
  await expect(ask.getByRole("button", { name: "Yes, continue as Siti Aminah" })).toBeVisible();
  await expect(ask.getByRole("button", { name: "No, I'm someone else" })).toBeVisible();

  // IPv6 privacy addresses change, the /64 doesn't: same phone + same /64 = strict.
  const v6 = async (addr: string) => {
    const ctx = await browser.newContext({ ...PHONE, extraHTTPHeaders: { "cf-connecting-ip": addr } });
    await asPhone(ctx, 5555);
    const pg2 = await ctx.newPage();
    await seenInstall(pg2, slug);
    await pg2.goto(`/e/${slug}`);
    await pg2.getByRole("button", { name: "Join", exact: true }).click();
    return { ctx, pg: pg2 };
  };
  const b1 = await v6("2001:db8:1:2:aaaa:bbbb:cccc:1");
  await b1.pg.getByLabel("Your name").fill("Bea");
  await b1.pg.getByRole("button", { name: /Let's go/ }).click();
  await expect(b1.pg.getByRole("button", { name: "You: Bea" })).toBeVisible();
  const b2 = await v6("2001:db8:1:2::99");
  await b2.pg.getByLabel("Your name").fill("Someone");
  await b2.pg.getByRole("button", { name: /Let's go/ }).click();
  await expect(b2.pg.getByRole("group", { name: "Welcome back" })).toContainText("This phone is already in the album as Bea");
  for (const c of [c9, b1.ctx, b2.ctx]) await c.close();

  // ---------------------------------------------------------------- organiser dashboard
  await page.goto(`/dashboard/events/${ev.id}`);
  await expect(page.getByRole("heading", { name: "🏆 Top snappers" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Mission masters" })).toBeVisible();
  await expect(page.getByRole("main").getByText("Siti Aminah").first()).toBeVisible();
  // Guests: the flagged same-phone guest is merged into Siti; Nora 2 is removed.
  await page.goto(`/dashboard/events/${ev.id}/guests`);
  await expect(page.getByText("Possibly the same phone (1)")).toBeVisible();
  await page.getByRole("button", { name: "Merge" }).click();
  await page.getByRole("alertdialog", { name: "Merge into Siti Aminah?" }).getByRole("button", { name: "Merge" }).click();
  await expect(page.getByText("Possibly the same phone")).toHaveCount(0);
  expect(await sql("select id from guests where event_id = $1 and name = 'Ali'", [ev.id])).toHaveLength(0);
  await page.getByRole("button", { name: "Remove Nora 2" }).click();
  await page.getByRole("alertdialog", { name: "Remove Nora 2?" }).getByRole("button", { name: "Remove guest" }).click();
  await expect(page.getByRole("button", { name: "Remove Nora 2" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Remove Nora", exact: true })).toHaveCount(1);
  // Photos: most loved sort and a guest filter.
  await page.goto(`/dashboard/events/${ev.id}/photos?sort=top`);
  await expect(page.getByRole("link", { name: "Most loved" })).toHaveClass(/bg-ink/);
  await expect(page.getByAltText("Photo by Siti Aminah").first()).toBeVisible();
  // A photo opens in a lightbox on the page (not a new tab) and zooms in place with the full file.
  await page.getByRole("button", { name: "Open photo by Siti Aminah" }).first().click();
  const box = page.getByRole("dialog", { name: "Photo" });
  await expect(box).toBeVisible();
  await box.getByRole("button", { name: "Zoom in" }).click();
  await expect(box.locator('[data-zoomed="true"] img')).toHaveAttribute("src", /full.jpg/);
  await box.getByRole("button", { name: "Zoom out" }).click();
  await box.getByRole("button", { name: "Next photo" }).click();
  await expect(box.getByText("2 /")).toBeVisible();
  await box.getByRole("button", { name: "Close photo" }).click();
  await expect(box).toHaveCount(0);

  // ---------------------------------------------------------------- fallback: the phone's camera app -> develop
  await g5.goto(`/e/${slug}`);
  await g5.locator("input[capture]").setInputFiles({ name: "snap.jpg", mimeType: "image/jpeg", buffer: await jpeg("#f2b134") });
  const dev = g5.getByRole("dialog", { name: "Your photo" });
  await expect(dev.getByRole("img", { name: "Photo preview" })).toBeVisible();
  await dev.getByRole("button", { name: "Share" }).click();
  await expect(dev).toHaveCount(0);

  // ---------------------------------------------------------------- first visit: intro, then join with a selfie
  const c10 = await browser.newContext(PHONE);
  await asPhone(c10, 9191);
  const g10 = await c10.newPage();
  await g10.addInitScript(() => localStorage.removeItem("pc-skip-intro"));
  await g10.goto(`/e/${slug}`);
  const intro = g10.getByRole("dialog", { name: "Welcome" });
  await expect(intro.getByRole("heading", { name: "Snap the day" })).toBeVisible();
  await intro.getByRole("button", { name: "Next" }).click();
  await intro.getByRole("button", { name: "Next" }).click();
  await intro.getByRole("button", { name: "Join the album 🎉" }).click();
  const selfieInput = g10.getByRole("dialog", { name: "Join the album" }).locator('input[capture="user"]');
  await selfieInput.setInputFiles({ name: "me.jpg", mimeType: "image/jpeg", buffer: await jpeg("#8a5cf6") });
  await expect(g10.getByRole("button", { name: "Add a selfie (optional)" }).locator("img")).toBeVisible();
  await g10.getByLabel("Your name").fill("Zara");
  await g10.getByRole("button", { name: /Let's go/ }).click();
  await expect(g10.getByRole("button", { name: "You: Zara" }).locator("img")).toBeVisible({ timeout: 60_000 }); // dev compiles the avatar route on first use
  const [zara] = await sql("select avatar_key from guests where event_id = $1 and name = 'Zara'", [ev.id]);
  expect(zara.avatar_key).toMatch(/\/avatars\//);
  await g10.reload();
  await expect(intro).toHaveCount(0); // only once

  // ---------------------------------------------------------------- host: guest view banner, settings, missions emoji
  await page.goto(`/e/${slug}`);
  await page.getByRole("link", { name: "Host dashboard" }).click();
  await expect(page).toHaveURL(new RegExp(`/dashboard/events/${ev.id}$`));
  await expect(page.getByRole("region", { name: "Getting started" })).toBeVisible();
  await page.goto(`/dashboard/events/${ev.id}/settings`);
  const tagBox = page.getByLabel("Add a hashtag");
  await page.getByRole("button", { name: /Remove #ceremony/ }).click();
  await tagBox.fill("bestnight");
  await tagBox.press("Enter");
  await page.getByLabel("Closed").check();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  const [st] = await sql("select suggested_tags, uploads_enabled from events where id = $1", [ev.id]);
  expect(st.suggested_tags).toContain("bestnight");
  expect(st.suggested_tags).not.toContain("ceremony");
  expect(st.uploads_enabled).toBe(false);
  await sql("update events set uploads_enabled = true where id = $1", [ev.id]);
  await page.goto(`/dashboard/events/${ev.id}/missions`);
  await page.getByRole("button", { name: /Mission emoji/ }).click();
  await page.getByRole("option", { name: "🎂" }).click();
  await page.getByPlaceholder("Selfie with the bride's mum").fill("Cake moment");
  await page.getByRole("button", { name: "Add mission" }).click();
  await expect(page.getByText("Mission added.")).toBeVisible();
  const [cake] = await sql("select emoji from event_missions where event_id = $1 and title = 'Cake moment'", [ev.id]);
  expect(cake.emoji).toBe("🎂");

  for (const c of [c1, c2, c3, c4, c5, c6, c7, c8, c10]) await c.close();
});
