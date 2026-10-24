import { test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import pg from "pg";

// SHOTS_DIR=<folder>: full-page phone captures (390x844) of every admin and organiser dashboard page,
// plus the open menu, for a mobile UI review. Skipped otherwise.

const ENV = readFileSync(".env.local", "utf8");
const DB = ENV.match(/^DATABASE_URL=(.*)$/m)![1].trim();
const dir = process.env.SHOTS_DIR;

async function sql<T = Record<string, unknown>>(text: string, params: unknown[] = []) {
  const c = new pg.Client({ connectionString: DB });
  await c.connect();
  try {
    return (await c.query(text, params)).rows as T[];
  } finally {
    await c.end();
  }
}

async function shot(page: Page, name: string, url: string) {
  await page.goto(url);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${dir}/m-${name}.png`, fullPage: true });
}

test("phone captures of the dashboards", async ({ browser }) => {
  test.skip(!dir, "set SHOTS_DIR");
  test.setTimeout(600_000);
  const email = `shots-${Date.now().toString(36)}@example.com`;
  await sql("insert into users (email, name, is_admin) values ($1, 'Aina Admin', true)", [email]);
  const [ev] = await sql<{ id: string }>("select id from events where paid_at is not null and purged_at is null and not is_demo order by photo_count desc limit 1");
  const [u] = await sql<{ id: string }>("select owner_id id from events where id = $1", [ev.id]);
  const [p] = await sql<{ id: string }>("select id from purchases where status = 'paid' order by amount_cents desc limit 1");
  const [plan] = await sql<{ id: string }>("select id from plans order by sort limit 1");

  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto("/login?next=/admin");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a code" }).click();
  await page.getByLabel("Login code").fill("123456");
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL((u) => u.pathname.startsWith("/admin"), { timeout: 120_000 }); // not /login?next=/admin

  const pages: [string, string][] = [
    ["a-overview", "/admin"],
    ["a-events", "/admin/events"],
    ["a-event", `/admin/events/${ev.id}`],
    ["a-users", "/admin/users"],
    ["a-user", `/admin/users/${u.id}`],
    ["a-payments", "/admin/payments"],
    ["a-payment", `/admin/payments/${p.id}`],
    ["a-plans", "/admin/plans"],
    ["a-plan", `/admin/plans/${plan.id}`],
    ["a-promos", "/admin/promos"],
    ["a-demos", "/admin/demos"],
    ["a-settings", "/admin/settings"],
    ["a-logs", "/admin/logs"],
    ["o-home", "/dashboard"],
    ["o-new", "/dashboard/events/new"],
    ["o-event", `/dashboard/events/${ev.id}`],
    ["o-photos", `/dashboard/events/${ev.id}/photos`],
    ["o-guests", `/dashboard/events/${ev.id}/guests`],
    ["o-missions", `/dashboard/events/${ev.id}/missions`],
    ["o-wishes", `/dashboard/events/${ev.id}/wishes`],
    ["o-qr", `/dashboard/events/${ev.id}/qr`],
    ["o-settings", `/dashboard/events/${ev.id}/settings`],
    ["o-package", `/dashboard/events/${ev.id}/checkout`],
    ["o-account", "/dashboard/account"],
  ];
  for (const [name, url] of pages) await shot(page, name, url);

  // The menu drawer, open, in an event and in the admin area.
  for (const [name, url] of [["menu-event", `/dashboard/events/${ev.id}`], ["menu-admin", "/admin"]]) {
    await page.goto(url);
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Open menu" }).click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${dir}/m-${name}.png` });
  }
  await ctx.close();
});
