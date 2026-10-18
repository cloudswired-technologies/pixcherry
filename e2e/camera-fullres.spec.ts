import { expect, test, type Browser, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join as joinPath } from "node:path";
import pg from "pg";
import sharp from "sharp";
import { asPhone } from "./phones";

// Every snap is a full-resolution photo from the camera, never a frame of the viewfinder:
// - where the browser can take a still (ImageCapture: Android Chrome, the fake webcam here) the
//   PixCamera takes it, and its viewfinder has the same shape as the photo (so the photo shows
//   what the guest saw, not more);
// - where it can't (iPhone Safari: simulated by removing ImageCapture), Snap opens the phone's
//   own camera app and "develop" adds the look.

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

async function paidEvent(prefix: string) {
  const [u] = await sql("insert into users (email) values ($1) returning id", [`${prefix}-${Date.now()}@example.com`]);
  const [plan] = await sql(
    "select p.id, p.code, p.name, p.price_cents, p.limits, p.features, json_build_object('name', q.name, 'max_px', q.max_px, 'jpeg_quality', q.jpeg_quality) quality from plans p join quality_presets q on q.id = p.quality_preset_id where p.code = 'basic'",
  );
  const snap = { plan_id: plan.id, code: plan.code, name: plan.name, price_cents: plan.price_cents, quality: plan.quality, limits: plan.limits, features: plan.features };
  const slug = `${prefix}${Date.now().toString(36)}`.slice(0, 12).replace(/[^a-z0-9]/g, "a").padEnd(10, "a");
  await sql(
    `insert into events (owner_id, slug, name, starts_at, ends_at, plan_id, plan_snapshot, paid_at, deletion_at)
     values ($1, $2, 'Camera E2E', now(), now() + interval '5 hours', $3, $4, now(), now() + interval '9 days')`,
    [u.id, slug, plan.id, JSON.stringify(snap)],
  );
  return slug;
}

// Its own "phone" (see phones.ts: also skips the first-visit intro), which has already seen the
// "install the app" prompt (it would cover the buttons).
let phoneId = 7000;
async function phone(browser: Browser, slug: string, extra: Parameters<Browser["newContext"]>[0] = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, ...extra });
  await asPhone(ctx, ++phoneId);
  await ctx.addInitScript((s) => localStorage.setItem(`pc-install-${s}`, "1"), slug);
  return ctx;
}
const snapButton = (g: Page) => g.getByRole("navigation", { name: "Actions" }).getByRole("button", { name: "Snap" });

test("PixCamera: full-resolution still, viewfinder in the photo's shape", async ({ browser }) => {
  const slug = await paidEvent("camfull");
  const ctx = await phone(browser, slug, { permissions: ["camera"] });
  const g = await ctx.newPage();
  await g.goto(`/e/${slug}`);
  await snapButton(g).click();
  await expect(g.getByRole("dialog", { name: "Join the album" })).toBeVisible();
  await g.getByLabel("Your name").fill("Lina");
  await g.getByRole("button", { name: /Let's go/ }).click();
  const cam = g.getByRole("dialog", { name: "Camera" });
  await expect(cam.getByRole("button", { name: "Take photo" })).toBeEnabled({ timeout: 20_000 });

  const shape = await g.evaluate(async () => {
    const v = document.querySelector('[aria-label="Camera"] video') as HTMLVideoElement;
    const t = (v.srcObject as MediaStream).getVideoTracks()[0];
    const s = t.getSettings();
    type Caps = { imageWidth?: { max?: number }; imageHeight?: { max?: number } };
    const IC = (window as unknown as { ImageCapture: new (t: MediaStreamTrack) => { getPhotoCapabilities(): Promise<Caps> } }).ImageCapture;
    const caps = await new IC(t).getPhotoCapabilities().catch(() => null);
    return { w: s.width ?? 0, h: s.height ?? 0, pw: caps?.imageWidth?.max ?? 0, ph: caps?.imageHeight?.max ?? 0 };
  });
  console.log("viewfinder", `${shape.w}x${shape.h}`, "photo", `${shape.pw}x${shape.ph}`);
  const ratio = (a: number, b: number) => Math.max(a, b) / Math.min(a, b);
  if (shape.pw && shape.ph) expect(Math.abs(ratio(shape.w, shape.h) - ratio(shape.pw, shape.ph))).toBeLessThan(0.02);

  await cam.getByRole("button", { name: "Take photo" }).click();
  await expect(cam.getByText(/MP · camera photo/)).toBeVisible({ timeout: 15_000 });
  await expect(cam.getByText(/couldn't take a full-quality photo/)).toHaveCount(0);
  await cam.getByRole("button", { name: "Share" }).click();
  await expect(cam.getByAltText("Last shot")).toBeVisible();
  await ctx.close();
});

test("No ImageCapture (iPhone): Snap opens the phone's camera, develop adds the look", async ({ browser }) => {
  const slug = await paidEvent("camios");
  const ctx = await phone(browser, slug);
  await ctx.addInitScript(() => {
    delete (window as unknown as { ImageCapture?: unknown }).ImageCapture;
  });
  const g = await ctx.newPage();
  await g.goto(`/e/${slug}`);

  // A 12 MP photo, as the phone's own camera would hand back.
  const file = joinPath(tmpdir(), `pixcherry-iphone-${Date.now()}.jpg`);
  await sharp({ create: { width: 4032, height: 3024, channels: 3, background: { r: 196, g: 120, b: 92 } } }).jpeg({ quality: 90 }).toFile(file);

  // Join first; on iOS the camera can only open from a tap, so the guest is told to tap Snap.
  await snapButton(g).click();
  await expect(g.getByRole("dialog", { name: "Join the album" })).toBeVisible();
  await g.getByLabel("Your name").fill("Mei Ling");
  // Chromium still counts the "Let's go" tap and opens the camera straight away; iOS doesn't, so
  // the guest is told to tap Snap. Listening first also keeps a real file dialog from blocking the page.
  const auto = g.waitForEvent("filechooser", { timeout: 8_000 }).catch(() => null);
  await g.getByRole("button", { name: /Let's go/ }).click();
  await expect(g.getByText("You're in! Tap Snap to take your photo 📸")).toBeVisible({ timeout: 15_000 });
  let chooser = await auto;
  if (!chooser) [chooser] = await Promise.all([g.waitForEvent("filechooser"), snapButton(g).click()]);
  await expect(g.getByRole("dialog", { name: "Camera" })).toHaveCount(0); // never the in-page camera
  await chooser.setFiles(file);

  const dev = g.getByRole("dialog", { name: "Your photo" });
  await expect(dev.getByRole("img", { name: "Photo preview" })).toBeVisible({ timeout: 15_000 });
  const reserve = g.waitForRequest((r) => r.url().includes(`/api/e/${slug}/uploads`) && r.method() === "POST", { timeout: 20_000 });
  await dev.getByRole("button", { name: "Share" }).click();
  await reserve;
  await ctx.close();
});
