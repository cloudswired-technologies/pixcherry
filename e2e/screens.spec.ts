import { expect, test } from "@playwright/test";
import { distinctPhones } from "./phones";
import { mkdirSync, readFileSync } from "node:fs";
import pg from "pg";
import sharp from "sharp";

// Screenshots for design review: SCREENS=1 npx playwright test e2e/screens.spec.ts → docs/screens/

test.skip(!process.env.SCREENS, "set SCREENS=1");

const DB = readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.*)$/m)![1].trim();
const OUT = "docs/screens";

async function sql(text: string, params: unknown[] = []) {
  const c = new pg.Client({ connectionString: DB });
  await c.connect();
  try {
    return (await c.query(text, params)).rows;
  } finally {
    await c.end();
  }
}

test("screens", async ({ browser }) => {
  distinctPhones(browser);
  mkdirSync(OUT, { recursive: true });
  mkdirSync("e2e/.fixtures/shots", { recursive: true });
  const colours = ["#e8553d", "#3d8be8", "#3de88b", "#d49b2e", "#6f63b8", "#c45a7a", "#5f8f7d", "#8c6b4f", "#4d7fb3"];
  const files: string[] = [];
  for (const [i, c] of colours.entries()) {
    const p = `e2e/.fixtures/shots/${i}.jpg`;
    const w = i % 3 === 0 ? 1200 : 1600;
    const h = i % 3 === 0 ? 1600 : 1200;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="${c}"/></linearGradient></defs><rect width="100%" height="100%" fill="${c}"/><rect width="100%" height="100%" fill="url(#g)"/><circle cx="${w * 0.7}" cy="${h * 0.35}" r="${w * 0.18}" fill="#fff" fill-opacity=".25"/></svg>`;
    await sharp(Buffer.from(svg)).jpeg({ quality: 85 }).toFile(p);
    files.push(p);
  }

  const desk = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const d = await desk.newPage();
  await d.goto("/");
  await d.screenshot({ path: `${OUT}/landing-desktop.png`, fullPage: true });

  // organiser (admin email so admin pages work too)
  await d.goto("/dashboard/events/new");
  await d.getByLabel("Email").fill("admin@example.com");
  await d.getByRole("button", { name: "Email me a code" }).click();
  await d.getByLabel("Login code").fill("123456");
  await d.getByRole("button", { name: "Log in" }).click();
  await d.getByLabel("Event name").fill("Aina & Hakim's Wedding");
  await d.getByLabel("Message for guests (optional)").fill("Thank you for celebrating with us! Share your photos from today here.");
  await d.screenshot({ path: `${OUT}/create-event.png` });
  await d.getByRole("button", { name: "Continue to package" }).click();
  await expect(d.getByRole("heading", { name: "Choose a package" })).toBeVisible();
  await d.screenshot({ path: `${OUT}/checkout.png`, fullPage: true });
  const id = d.url().split("/events/")[1].split("/")[0];
  const [premium] = await sql("select id from plans where code = 'premium'");
  await d.goto(`/admin/events/${id}`);
  await d.locator('select[name="plan_id"]').selectOption(premium.id);
  await d.getByRole("button", { name: "Activate" }).click();
  await expect(d.getByText("Event activated")).toBeVisible();
  const [ev] = await sql("select slug from events where id = $1", [id]);

  await d.goto(`/dashboard/events/${id}/engage`);
  await d.getByRole("button", { name: "Add the wedding pack" }).click();
  await expect(d.getByText("Selfie with the couple")).toBeVisible();
  await d.screenshot({ path: `${OUT}/organiser-engage.png`, fullPage: true });

  const imagesLoaded = (p: typeof d) => p.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 15_000 }).catch(() => {});
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, permissions: ["camera"] });
  const g = await phone.newPage();
  await g.goto(`/e/${ev.slug}`);
  await g.screenshot({ path: `${OUT}/guest-first-visit.png` });
  await g.getByRole("button", { name: "Upload" }).click();
  await g.getByLabel("Your name").fill("Siti");
  await g.screenshot({ path: `${OUT}/guest-join.png` });
  await g.getByRole("button", { name: /Let's go/ }).click();
  await expect(g.getByText(/You have\s*\d+\s*shots left/)).toBeVisible();
  await g.locator("input[type=file][multiple]").setInputFiles(files);
  await g.getByRole("button", { name: new RegExp(`Share ${files.length} photos`) }).click();
  await expect(g.getByRole("status")).toContainText("photos shared", { timeout: 60_000 });
  await g.screenshot({ path: `${OUT}/guest-celebrate.png` });
  await expect(g.getByAltText("Photo by Siti")).toHaveCount(files.length, { timeout: 60_000 });

  // A second guest via the camera on a mission, with hearts and a wish.
  const phone2 = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, permissions: ["camera"] });
  const g2 = await phone2.newPage();
  await g2.goto(`/e/${ev.slug}`);
  await g2.getByRole("button", { name: /Selfie with the couple/ }).first().click();
  await g2.getByLabel("Your name").fill("Amir");
  await g2.getByRole("button", { name: /Let's go/ }).click();
  const cam = g2.getByRole("dialog", { name: "Camera" });
  await expect(cam.getByRole("button", { name: "Take photo" })).toBeEnabled({ timeout: 15_000 });
  await cam.getByRole("button", { name: "Golden Hour" }).click();
  await g2.waitForTimeout(800);
  await g2.screenshot({ path: `${OUT}/camera.png` });
  await cam.getByRole("button", { name: "Take photo" }).click();
  await expect(cam.getByAltText("Your photo")).toBeVisible();
  await g2.waitForTimeout(700);
  await g2.screenshot({ path: `${OUT}/camera-review.png` });
  await cam.getByRole("button", { name: "Share" }).click();
  await expect(cam.getByAltText("Last shot")).toBeVisible();
  await cam.getByRole("button", { name: "Polaroid" }).click();
  await g2.waitForTimeout(800);
  await g2.screenshot({ path: `${OUT}/camera-polaroid.png` });
  await cam.getByRole("button", { name: "Back to album" }).click();
  await g2.getByRole("button", { name: "Write a wish" }).click();
  await g2.getByRole("textbox").fill("Selamat pengantin baru Aina & Hakim! Semoga bahagia hingga ke Jannah 🤍");
  await g2.getByRole("button", { name: "Send wish" }).click();
  await expect(g2.getByText("— Amir")).toBeVisible();
  await g2.getByRole("button", { name: "All Photos", exact: true }).click();
  await expect(g2.getByAltText("Photo by Siti")).toHaveCount(files.length, { timeout: 30_000 });
  for (const i of [0, 1, 2]) {
    await g2.getByAltText("Photo by Siti").nth(i).click();
    await g2.getByRole("button", { name: "Heart this photo" }).click();
    await g2.getByRole("button", { name: "Close" }).click();
  }

  await g.reload();
  await expect(g.getByText("1/8")).toHaveCount(0); // Siti did no missions
  await imagesLoaded(g);
  await g.screenshot({ path: `${OUT}/guest-home.png` });
  await g.screenshot({ path: `${OUT}/guest-gallery.png`, fullPage: true });
  await g.getByRole("button", { name: "People", exact: true }).click();
  await imagesLoaded(g);
  await g.waitForTimeout(500);
  await g.screenshot({ path: `${OUT}/guest-people.png`, fullPage: true });
  await g.getByRole("button", { name: "Highlights" }).click();
  await imagesLoaded(g);
  await g.waitForTimeout(800);
  await g.screenshot({ path: `${OUT}/guest-highlights.png`, fullPage: true });
  await g.getByRole("button", { name: "All Photos", exact: true }).click();
  await imagesLoaded(g);
  await g.waitForTimeout(600);
  await g.screenshot({ path: `${OUT}/guest-all.png`, fullPage: true });
  await g.getByRole("button", { name: /^Wishes/ }).click();
  await g.waitForTimeout(800);
  await g.screenshot({ path: `${OUT}/guest-wishes.png`, fullPage: true });
  await g.getByRole("button", { name: "All Photos", exact: true }).click();
  await g.getByAltText("Photo by Siti").nth(1).click();
  await g.waitForTimeout(800);
  await g.screenshot({ path: `${OUT}/guest-viewer.png` });
  await g.getByRole("button", { name: "Close" }).click();
  await phone2.close();

  await d.goto(`/dashboard/events/${id}`);
  await d.screenshot({ path: `${OUT}/event-overview.png`, fullPage: true });
  const dp = await phone.newPage();
  await dp.context().addCookies((await desk.cookies()).filter((c) => c.name === "pc_session"));
  await dp.goto(`/dashboard/events/${id}`);
  await dp.screenshot({ path: `${OUT}/event-overview-phone.png`, fullPage: true });
  await d.goto(`/dashboard/events/${id}/qr`);
  await d.screenshot({ path: `${OUT}/qr-card.png`, fullPage: true });
  await d.goto(`/dashboard/events/${id}/photos`);
  await d.screenshot({ path: `${OUT}/photos.png`, fullPage: true });
  await d.goto("/admin");
  await d.screenshot({ path: `${OUT}/admin.png`, fullPage: true });
  await d.goto("/admin/plans");
  await d.getByText("Basic").first().click();
  await d.screenshot({ path: `${OUT}/admin-plan.png`, fullPage: true });
  await d.goto(`/e/${ev.slug}/slideshow`);
  await d.waitForTimeout(2500);
  await d.screenshot({ path: `${OUT}/slideshow.png` });
  await desk.close();
  await phone.close();
});
