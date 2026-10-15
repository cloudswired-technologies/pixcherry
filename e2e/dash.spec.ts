import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import pg from "pg";

// DASH=1: screenshots of the organiser dashboard (desktop + phone) using the
// newest event left behind by social.spec.ts. Output: docs/screens/dash-*.png
test.skip(!process.env.DASH, "set DASH=1");

const DB = readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.*)$/m)![1].trim();

test("dashboard screens", async ({ browser }) => {
  test.setTimeout(180_000);
  const c = new pg.Client({ connectionString: DB });
  await c.connect();
  const { rows } = await c.query(
    "select e.id, u.email from events e join users u on u.id = e.owner_id where u.email like 'social-%' and e.paid_at is not null order by e.created_at desc limit 1",
  );
  await c.end();
  const [{ id, email }] = rows;
  for (const [name, opts] of [
    ["desk", { viewport: { width: 1360, height: 900 } }],
    ["phone", { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }],
  ] as const) {
    const ctx = await browser.newContext(opts);
    const p = await ctx.newPage();
    await p.goto(`/dashboard/events/${id}`);
    await p.getByLabel("Email").fill(email);
    await p.getByRole("button", { name: "Email me a code" }).click();
    await p.getByLabel("Login code").fill("123456");
    await p.getByRole("button", { name: "Log in" }).click();
    await expect(p.getByRole("heading", { name: "🏆 Top snappers" })).toBeVisible();
    for (const [page, path] of [
      ["overview", ""],
      ["photos", "/photos"],
      ["guests", "/guests"],
      ["missions", "/missions"],
      ["wishes", "/wishes"],
      ["settings", "/settings"],
    ]) {
      await p.goto(`/dashboard/events/${id}${path}`);
      await p.waitForLoadState("networkidle");
      await p.screenshot({ path: `docs/screens/dash-${name}-${page}.png`, fullPage: name === "desk" });
    }
    if (name === "phone") {
      await p.getByRole("button", { name: "Open menu" }).click();
      await p.waitForTimeout(400);
      await p.screenshot({ path: "docs/screens/dash-phone-menu.png" });
    }
    await ctx.close();
  }
});
