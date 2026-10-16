import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import pg from "pg";

// The album follows the event's dates: before the start time guests see a countdown
// (no join, no uploads), the host can preview; once the event starts the dates are
// fixed, so one payment covers one event and retention can't be stretched.

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

async function login(page: Page, email: string, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a code" }).click();
  await page.getByLabel("Login code").fill("123456");
  await page.getByRole("button", { name: "Log in" }).click();
}

const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };
const local = (d: Date) => new Date(d.getTime() + 8 * 3600_000).toISOString().slice(0, 16);

test("countdown before the start, host preview, dates locked once started", async ({ browser, page }) => {
  test.setTimeout(240_000);
  const tag = Date.now().toString(36);
  const email = `open-${tag}@example.com`;
  const slug = `open-${tag}`;
  const [u] = await sql("insert into users (email) values ($1) returning id", [email]);
  const [ev] = await sql(
    `insert into events (owner_id, slug, name, venue, starts_at, ends_at, plan_id, plan_snapshot, paid_at, deletion_at)
     select $1, $2, 'Opening Day', 'Dewan Besar', now() + interval '2 days', now() + interval '2 days 5 hours', p.id,
       jsonb_build_object('plan_id', p.id, 'code', p.code, 'name', p.name, 'price_cents', p.price_cents, 'limits', p.limits, 'features', p.features,
         'quality', json_build_object('name', q.name, 'max_px', q.max_px, 'jpeg_quality', q.jpeg_quality)),
       now(), now() + interval '16 days'
     from plans p join quality_presets q on q.id = p.quality_preset_id where p.code = 'premium' returning id`,
    [u.id, slug],
  );

  // ---- a guest before the start: countdown, nothing to join, the API refuses uploads
  const gc = await browser.newContext(PHONE);
  const g = await gc.newPage();
  await g.goto(`/e/${slug}`);
  await expect(g.getByRole("heading", { name: "Opening Day" })).toBeVisible();
  await expect(g.getByText("The photo album opens in")).toBeVisible();
  await expect(g.getByRole("timer")).toContainText(/day/);
  await expect(g.getByRole("button", { name: "Join", exact: true })).toHaveCount(0);
  const up = await g.request.post(`/api/e/${slug}/uploads`, { data: { files: [{ type: "image/jpeg", size: 50_000 }] } });
  expect(up.status()).toBe(403);

  // ---- the host previews the album
  await login(page, email, `/dashboard/events/${ev.id}`);
  await expect(page.getByText(/Opens /).first()).toBeVisible({ timeout: 60_000 });
  await page.goto(`/e/${slug}`);
  await expect(page.getByText("Preview.")).toBeVisible();
  await expect(page.getByText("The photo album opens in")).toHaveCount(0);

  // ---- before the start: dates can move, but not into the past
  await page.goto(`/dashboard/events/${ev.id}/settings`);
  await page.locator('input[name="starts_at"]').fill(local(new Date(Date.now() - 3 * 86400_000)));
  await page.locator('input[name="ends_at"]').fill(local(new Date(Date.now() - 3 * 86400_000 + 3 * 3600_000)));
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("The start can't be in the past.")).toBeVisible();
  const later = new Date(Date.now() + 3 * 86400_000);
  await page.locator('input[name="starts_at"]').fill(local(later));
  await page.locator('input[name="ends_at"]').fill(local(new Date(later.getTime() + 4 * 3600_000)));
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  const [moved] = await sql("select starts_at from events where id = $1", [ev.id]);
  expect(Math.abs(new Date(moved.starts_at).getTime() - Math.floor(later.getTime() / 60_000) * 60_000)).toBeLessThan(61_000);

  // ---- the countdown opens the album by itself at the start time
  await sql("update events set starts_at = now() + interval '6 seconds', ends_at = now() + interval '5 hours' where id = $1", [ev.id]);
  await g.goto(`/e/${slug}`);
  await expect(g.getByText("The photo album opens in")).toBeVisible();
  await expect(g.getByRole("button", { name: "Join", exact: true })).toBeVisible({ timeout: 30_000 });

  // ---- once started the dates are fixed (the deletion date doesn't move)
  const [before] = await sql("select starts_at, ends_at, deletion_at from events where id = $1", [ev.id]);
  await page.goto(`/dashboard/events/${ev.id}/settings`);
  await expect(page.getByText("The dates are fixed now that the event has started.", { exact: false })).toBeVisible();
  await expect(page.locator('input[name="starts_at"]')).toHaveAttribute("readonly", "");
  await page.locator('input[name="name"]').fill("Opening Day (renamed)");
  // Even a hand-edited form can't move the dates.
  await page.evaluate(() => {
    const s = document.querySelector<HTMLInputElement>('input[name="starts_at"]')!;
    s.readOnly = false;
    s.value = "2027-06-01T10:00";
    const e = document.querySelector<HTMLInputElement>('input[name="ends_at"]')!;
    e.readOnly = false;
    e.value = "2027-06-01T15:00";
  });
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  const [after] = await sql("select name, starts_at, ends_at, deletion_at from events where id = $1", [ev.id]);
  expect(after.name).toBe("Opening Day (renamed)");
  expect(new Date(after.starts_at).getTime()).toBe(new Date(before.starts_at).getTime());
  expect(new Date(after.ends_at).getTime()).toBe(new Date(before.ends_at).getTime());
  // Deletion = the (fixed) end + the package's storage days, whatever the form sent.
  const [{ days }] = await sql("select (plan_snapshot->'limits'->>'retention_days')::int as days from events where id = $1", [ev.id]);
  expect(new Date(after.deletion_at).getTime()).toBe(new Date(before.ends_at).getTime() + days * 86400_000);
  await gc.close();
});
