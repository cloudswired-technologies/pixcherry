import { expect, test, type Browser } from "@playwright/test";
import { readFileSync } from "node:fs";
import pg from "pg";

// Audit probe (2026-10-16): two DIFFERENT people with the same phone model on the
// same venue Wi-Fi. Both report identical device signals (like two iPhone 15s:
// same screen, pixel ratio, time zone, touch points, "Apple GPU"). Can the second
// person join as themselves?   PROBE=1 npx playwright test e2e/probe-same-model.spec.ts

test.skip(!process.env.PROBE, "set PROBE=1");

const DB = readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.*)$/m)![1].trim();
async function sql(text: string, params: unknown[] = []) {
  const c = new pg.Client({ connectionString: DB });
  await c.connect();
  try {
    return (await c.query(text, params)).rows;
  } finally {
    await c.end();
  }
}

/** A phone that looks exactly like an iPhone 15 to the device check. */
async function iphone15(browser: Browser, slug: string) {
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await ctx.addInitScript((s) => {
    localStorage.setItem("pc-skip-intro", "1");
    localStorage.setItem(`pc-install-${s}`, "1");
    Object.defineProperty(Screen.prototype, "width", { get: () => 393, configurable: true });
    Object.defineProperty(Screen.prototype, "height", { get: () => 852, configurable: true });
    Object.defineProperty(Navigator.prototype, "maxTouchPoints", { get: () => 5, configurable: true });
    Object.defineProperty(Navigator.prototype, "hardwareConcurrency", { get: () => 4, configurable: true });
    const orig = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function (p: number) {
      if (p === 0x9246 || p === 0x1f01) return "Apple GPU"; // UNMASKED_RENDERER_WEBGL / RENDERER
      return orig.call(this, p);
    };
  }, slug);
  const page = await ctx.newPage();
  await page.goto(`/e/${slug}`);
  return { ctx, page };
}

test("two people, same phone model, same Wi-Fi", async ({ browser }) => {
  test.setTimeout(180_000);
  const tag = Date.now().toString(36);
  const slug = `probe-${tag}`;
  const [u] = await sql("insert into users (email) values ($1) returning id", [`probe-${tag}@example.com`]);
  await sql(
    `insert into events (owner_id, slug, name, starts_at, ends_at, plan_id, plan_snapshot, paid_at, deletion_at)
     select $1, $2, 'Probe', now() - interval '1 hour', now() + interval '3 hours', p.id,
       jsonb_build_object('code', p.code, 'name', p.name, 'price_cents', p.price_cents, 'limits', p.limits, 'features', p.features,
         'quality', json_build_object('name', q.name, 'max_px', q.max_px, 'jpeg_quality', q.jpeg_quality)),
       now(), now() + interval '9 days'
     from plans p join quality_presets q on q.id = p.quality_preset_id where p.code = 'premium'`,
    [u.id, slug],
  );

  const a = await iphone15(browser, slug);
  await a.page.getByRole("button", { name: "Join", exact: true }).click();
  await a.page.getByLabel("Your name").fill("Siti");
  await a.page.getByRole("button", { name: /Let's go/ }).click();
  await expect(a.page.getByRole("button", { name: "You: Siti" })).toBeVisible({ timeout: 30_000 });

  const b = await iphone15(browser, slug);
  await b.page.getByRole("button", { name: "Join", exact: true }).click();
  await b.page.getByLabel("Your name").fill("Aminah");
  await b.page.getByRole("button", { name: /Let's go/ }).click();
  await b.page.waitForTimeout(4000);
  const dialog = (await b.page.locator("[role=dialog]").allInnerTexts()).join(" || ");
  await b.page.screenshot({ path: "test-results/probe-second-person.png" });
  const guests = await sql("select g.name, g.same_phone_as is not null as flagged from guests g join events e on e.id = g.event_id where e.slug = $1 order by g.created_at", [slug]);
  console.log("SECOND PERSON SEES:\n" + dialog.replace(/\n+/g, " | "));
  console.log("GUESTS IN DB:", JSON.stringify(guests));
  await a.ctx.close();
  await b.ctx.close();
});
