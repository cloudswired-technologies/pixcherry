import { expect, test, chromium, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import pg from "pg";
import sharp from "sharp";
import { asPhone } from "./phones";

// Screen recording for the landing page's explainer video: a guest opens the album,
// joins with a selfie, snaps with PixCamera (the fake camera plays a real photo),
// shares, sees it land, hearts a photo and writes a wish. Uses the wedding event
// left by demo.spec.ts. Step captions and tap circles are drawn over the page.
//   VIDEO=1 npx playwright test e2e/video.spec.ts   → docs/screens/demo/video/guest.webm

test.skip(!process.env.VIDEO, "set VIDEO=1");

const OUT = "docs/screens/demo/video";
const PHOTOS = "e2e/.fixtures/photos";

/** Big caption at the top + a ring wherever the "finger" taps. */
async function overlay(page: Page) {
  await page.addInitScript(() => {
    const css = `
      #pc-cap{position:fixed;left:12px;right:12px;top:10px;z-index:2147483647;pointer-events:none;
        background:rgba(17,17,20,.86);color:#fff;font:700 15px/1.3 system-ui,sans-serif;border-radius:14px;
        padding:10px 14px;transition:opacity .25s;opacity:0}
      #pc-cap b{color:#ff6b86;margin-right:6px}
      .pc-tap{position:fixed;z-index:2147483646;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;
        border:3px solid #e91d48;background:rgba(233,29,72,.18);pointer-events:none;animation:pc-tap .6s ease-out forwards}
      @keyframes pc-tap{from{transform:scale(.4);opacity:1}to{transform:scale(1.3);opacity:0}}`;
    const add = () => {
      const s = document.createElement("style");
      s.textContent = css;
      document.head.appendChild(s);
      const c = document.createElement("div");
      c.id = "pc-cap";
      document.body.appendChild(c);
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", add);
    else add();
    window.addEventListener(
      "pointerdown",
      (e) => {
        const r = document.createElement("div");
        r.className = "pc-tap";
        r.style.left = `${e.clientX}px`;
        r.style.top = `${e.clientY}px`;
        document.body.appendChild(r);
        setTimeout(() => r.remove(), 700);
      },
      true,
    );
  });
}

// Where each caption starts, in seconds from the start of the recording.
const chapters: { at: number; title: string }[] = [];
let t0 = 0;

async function caption(page: Page, n: number, text: string) {
  chapters.push({ at: (Date.now() - t0) / 1000, title: text });
  await page.evaluate(
    ([n, text]) => {
      const c = document.getElementById("pc-cap");
      if (!c) return;
      c.innerHTML = `<b>${n}</b>${text}`;
      c.style.opacity = "1";
    },
    [String(n), text],
  );
  await page.waitForTimeout(1600);
}

const pause = (page: Page, ms = 900) => page.waitForTimeout(ms);

test("explainer video: a guest's first minute", async () => {
  test.setTimeout(300_000);
  mkdirSync(OUT, { recursive: true });
  const { wedding } = JSON.parse(readFileSync("docs/screens/demo/events.json", "utf8")) as { wedding: { id: string; slug: string } };
  // A re-recording starts clean: remove Nadia (and her photo and wish) from the last take.
  const db = new pg.Client({ connectionString: readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.*)$/m)![1].trim() });
  await db.connect();
  const old = await db.query("select id from guests where event_id = $1 and name = 'Nadia'", [wedding.id]);
  for (const g of old.rows) {
    await db.query("delete from photos where guest_id = $1", [g.id]);
    await db.query("delete from wishes where guest_id = $1", [g.id]);
    await db.query("delete from photo_votes where guest_id = $1", [g.id]);
    await db.query("delete from guests where id = $1", [g.id]);
  }
  // The video is "at the party": the event is happening now (the demo moved it into the past for its recap).
  await db.query("update events set starts_at = now() - interval '2 hours', ends_at = now() + interval '4 hours' where id = $1", [wedding.id]);
  await db.query("update events set photo_count = (select count(*) from photos where event_id = $1 and status in ('ready','review')), guest_count = (select count(*) from guests where event_id = $1) where id = $1", [wedding.id]);
  await db.end();
  const cam = resolve(OUT, "camera.mjpeg");
  writeFileSync(cam, await sharp(join(PHOTOS, "photo-22.jpg")).resize(1280, 960, { fit: "cover" }).jpeg({ quality: 92 }).toBuffer());
  const browser = await chromium.launch({
    channel: "msedge",
    args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", `--use-file-for-fake-video-capture=${cam}`],
  });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    baseURL: "http://localhost:3000",
    permissions: ["camera"],
    recordVideo: { dir: OUT, size: { width: 390, height: 844 } },
  });
  await asPhone(ctx, 9901);
  await ctx.addInitScript((s) => localStorage.setItem(`pc-install-${s}`, "1"), wedding.slug);
  const page = await ctx.newPage();
  t0 = Date.now(); // the recording starts with the page
  await overlay(page);

  // Warm the pages first so the recording has no compile waits.
  await page.goto(`/e/${wedding.slug}`);
  await expect(page.getByRole("heading", { name: "Aina & Hakim's Wedding" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Aina & Hakim's Wedding" })).toBeVisible();

  await caption(page, 1, "Scan the QR code — the album opens. No app.");
  await page.mouse.wheel(0, 380);
  await pause(page, 1400);
  await page.mouse.wheel(0, -380);
  await pause(page);

  await caption(page, 2, "Tap Snap, add your name and a selfie");
  await page.getByRole("navigation", { name: "Actions" }).getByRole("button", { name: "Snap" }).click();
  await expect(page.getByRole("dialog", { name: "Join the album" })).toBeVisible();
  await pause(page, 600);
  await page.getByLabel("Your name").pressSequentially("Nadia", { delay: 120 });
  const selfie = await sharp(join(PHOTOS, "photo-18.jpg")).resize(600, 600, { fit: "cover", position: sharp.strategy.attention }).jpeg().toBuffer();
  await page.locator('input[capture="user"]').first().setInputFiles({ name: "me.jpg", mimeType: "image/jpeg", buffer: selfie });
  await pause(page);
  await page.getByRole("button", { name: /Let's go/ }).click();

  const camera = page.getByRole("dialog", { name: "Camera" });
  await expect(camera.getByRole("button", { name: "Take photo" })).toBeEnabled({ timeout: 20_000 });
  await caption(page, 3, "Pick a film look, then take the shot");
  for (const look of ["Disposable", "Polaroid", "Kodak Gold"]) {
    await camera.getByRole("button", { name: look }).click();
    await pause(page, 1100);
  }
  await camera.getByRole("button", { name: "Take photo" }).click();
  await expect(camera.getByAltText("Your photo")).toBeVisible();
  await pause(page);
  await caption(page, 4, "Add a caption and share it with everyone");
  await camera.getByRole("button", { name: "Add caption" }).click();
  await camera.getByRole("dialog", { name: "Write a caption" }).getByLabel("Caption").pressSequentially("Squad goals 📸", { delay: 110 });
  await camera.getByRole("button", { name: "Done" }).click();
  await pause(page);
  await camera.getByRole("button", { name: "Share" }).click();
  await expect(camera.getByAltText("Last shot")).toBeVisible();
  await pause(page, 1200);
  await camera.getByRole("button", { name: "Back to album" }).click();

  await caption(page, 5, "It lands in the shared album in seconds");
  await page.getByRole("navigation", { name: "Sections" }).getByRole("button", { name: "All Photos" }).click();
  await expect(page.getByAltText("Photo by Nadia").filter({ visible: true }).first()).toBeVisible({ timeout: 60_000 });
  await pause(page, 1500);

  await caption(page, 6, "Browse everyone's photos and heart your favourites");
  await page.locator("main img[alt^='Photo by Siti']").filter({ visible: true }).first().click();
  await pause(page, 900);
  await page.getByRole("button", { name: "Heart this photo" }).click();
  await pause(page, 1300);
  await page.getByRole("button", { name: "Close" }).click();
  await pause(page, 600);

  await caption(page, 7, "Leave a wish for the hosts");
  await page.getByRole("button", { name: "Wishes" }).last().click();
  await page.getByRole("textbox").pressSequentially("Congratulations both! What a day 🤍", { delay: 70 });
  await pause(page, 600);
  await page.getByRole("button", { name: "Send wish" }).click();
  await expect(page.getByText("— Nadia")).toBeVisible();
  await pause(page, 2200);

  await ctx.close();
  await browser.close();
  const webm = readdirSync(OUT).find((f) => f.endsWith(".webm") && f !== "guest.webm");
  expect(webm).toBeTruthy();
  renameSync(join(OUT, webm!), join(OUT, "guest.webm"));
  // Trim the warm-up: chapters relative to the first caption (minus a short lead-in).
  const start = Math.max(0, chapters[0].at - 0.5);
  writeFileSync(join(OUT, "chapters.json"), JSON.stringify({ start, chapters: chapters.map((c) => ({ at: Math.round((c.at - start) * 10) / 10, title: c.title })) }, null, 2));
});
