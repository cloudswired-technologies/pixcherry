import { expect, test } from "@playwright/test";
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

  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const g = await phone.newPage();
  await g.goto(`/e/${ev.slug}`);
  await g.screenshot({ path: `${OUT}/guest-join.png` });
  await g.getByLabel("Your name").fill("Siti");
  await g.getByRole("button", { name: "Start sharing photos" }).click();
  await g.locator("input[type=file][multiple]").setInputFiles(files);
  await expect(g.getByText(`${files.length} uploaded`)).toBeVisible({ timeout: 60_000 });
  await expect(g.getByAltText("Photo by Siti")).toHaveCount(files.length, { timeout: 60_000 });
  await g.screenshot({ path: `${OUT}/guest-gallery.png`, fullPage: true });
  await g.getByAltText("Photo by Siti").nth(1).click();
  await g.waitForTimeout(800);
  await g.screenshot({ path: `${OUT}/guest-viewer.png` });

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
