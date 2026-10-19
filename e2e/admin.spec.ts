import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import pg from "pg";

// Admin → Organisers and Payments: edit a profile, suspend (the organiser really can't sign in),
// lift it, make/remove admin, record a refund (receipt + CSV + revenue show it), close an account.

const ENV = readFileSync(".env.local", "utf8");
const DB = ENV.match(/^DATABASE_URL=(.*)$/m)![1].trim();

async function sql<T = Record<string, unknown>>(text: string, params: unknown[] = []) {
  const c = new pg.Client({ connectionString: DB });
  await c.connect();
  try {
    return (await c.query(text, params)).rows as T[];
  } finally {
    await c.end();
  }
}

async function signIn(page: Page, email: string, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a code" }).click();
  await page.getByLabel("Login code").fill("123456");
  await page.getByRole("button", { name: "Log in" }).click();
}

test("organisers and payments", async ({ browser, page }) => {
  test.setTimeout(240_000);
  const stamp = Date.now().toString(36);
  const adminEmail = `adm-${stamp}@example.com`;
  const orgEmail = `org-${stamp}@example.com`;
  const goneEmail = `gone-${stamp}@example.com`;
  await sql("insert into users (email, is_admin) values ($1, true)", [adminEmail]);
  const [org] = await sql<{ id: string }>("insert into users (email, name) values ($1, 'Siti Planner') returning id", [orgEmail]);
  const [gone] = await sql<{ id: string }>("insert into users (email) values ($1) returning id", [goneEmail]);
  const [plan] = await sql<{ id: string; code: string; name: string; price_cents: number; limits: unknown; features: unknown; quality: unknown }>(
    "select p.id, p.code, p.name, p.price_cents, p.limits, p.features, json_build_object('name', q.name, 'max_px', q.max_px, 'jpeg_quality', q.jpeg_quality) quality from plans p join quality_presets q on q.id = p.quality_preset_id where p.code = 'premium'",
  );
  const snap = { plan_id: plan.id, code: plan.code, name: plan.name, price_cents: plan.price_cents, quality: plan.quality, limits: plan.limits, features: plan.features };
  const slug = `adm${stamp}`.replace(/[^a-z0-9]/g, "a").padEnd(10, "a").slice(0, 20);
  const [ev] = await sql<{ id: string }>(
    `insert into events (owner_id, slug, name, starts_at, ends_at, plan_id, plan_snapshot, paid_at, deletion_at)
     values ($1, $2, 'Majlis Admin Test', now() + interval '3 days', now() + interval '3 days 5 hours', $3, $4, now(), now() + interval '30 days') returning id`,
    [org.id, slug, plan.id, JSON.stringify(snap)],
  );
  await sql("insert into events (owner_id, slug, name, starts_at, ends_at) values ($1, $2, 'Draft to go', now() + interval '9 days', now() + interval '9 days 2 hours')", [gone.id, `${slug}x`]);
  const receipt = `PCTEST-${stamp}`.toUpperCase();
  const [pay] = await sql<{ id: string }>(
    `insert into purchases (event_id, user_id, kind, plan_id, description, subtotal_cents, discount_cents, amount_cents, status, receipt_no, paid_at, chip_purchase_id)
     values ($1, $2, 'plan', $3, 'Premium package', 12900, 0, 12900, 'paid', $4, now(), $5) returning id`,
    [ev.id, org.id, plan.id, receipt, `chip-${stamp}`],
  );
  await sql(
    `insert into purchases (event_id, user_id, kind, plan_id, description, subtotal_cents, amount_cents, status, chip_purchase_id)
     values ($1, $2, 'upgrade', $3, 'Upgrade to Exclusive', 17000, 17000, 'pending', $4)`,
    [ev.id, org.id, plan.id, `chip-pending-${stamp}`],
  );

  await signIn(page, adminEmail, "/admin/users");
  await expect(page.getByRole("heading", { name: "Organisers" })).toBeVisible({ timeout: 60_000 });

  // Find the organiser and edit the profile.
  await page.getByLabel("Search organisers").fill(orgEmail);
  await page.getByLabel("Search organisers").press("Enter");
  await page.getByRole("link", { name: /Siti Planner/ }).click();
  await expect(page.getByRole("heading", { name: "Siti Planner" })).toBeVisible();
  await expect(page.getByText("Majlis Admin Test").first()).toBeVisible();
  await page.getByLabel("Phone").fill("+60 12-345 6789");
  await page.getByLabel(/Admin note/).fill("Wedding planner from JB");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  expect((await sql<{ phone: string; admin_note: string }>("select phone, admin_note from users where id = $1", [org.id]))[0]).toEqual({ phone: "+60 12-345 6789", admin_note: "Wedding planner from JB" });

  // Suspend: asks first, then the organiser can't sign in.
  await page.getByLabel("Reason (only admins see it)").fill("Chargeback on CHIP");
  await page.getByRole("button", { name: "Suspend account" }).click();
  const ask = page.getByRole("alertdialog");
  await expect(ask).toContainText("Suspend Siti Planner?");
  await ask.getByRole("button", { name: "Suspend", exact: true }).click();
  await expect(page.getByText(/Suspended on .*Chargeback on CHIP/)).toBeVisible();
  const orgCtx = await browser.newContext();
  const orgPage = await orgCtx.newPage();
  await signIn(orgPage, orgEmail, "/dashboard");
  await expect(orgPage.getByText("This account is suspended.")).toBeVisible();
  await expect(orgPage).toHaveURL(/\/login/);

  // Lift it; they can sign in again.
  await page.getByRole("button", { name: "Lift suspension" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Lift suspension" }).click();
  await expect(page.getByText(/Suspended on/)).toHaveCount(0);
  await signIn(orgPage, orgEmail, "/dashboard");
  await expect(orgPage).toHaveURL(/\/dashboard/, { timeout: 60_000 });
  await orgCtx.close();

  // Admin on and off.
  await page.getByRole("button", { name: "Make admin" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Make admin" }).click();
  await expect(page.getByText("Can open this admin area and change everything here.")).toBeVisible();
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Remove admin" }).click();
  await expect(page.getByText("A normal organiser.")).toBeVisible();

  // Payments: the paid one, refund RM50 (asks first), receipt, CSV, revenue.
  await page.goto(`/admin/payments?q=${receipt}`);
  await expect(page.getByRole("heading", { name: "Payments" })).toBeVisible();
  await page.getByRole("link", { name: new RegExp(receipt) }).click();
  await expect(page.getByRole("heading", { name: "RM129" })).toBeVisible();
  await page.getByLabel("Amount refunded (RM)").fill("50");
  await page.getByLabel("Note (only admins see it)").fill("Half refund, guests list shrank");
  await page.getByRole("button", { name: "Record refund" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Record refund" }).click();
  await expect(page.getByRole("heading", { name: "Refund recorded" })).toBeVisible();
  await expect(page.getByText("Refunded RM50").first()).toBeVisible();
  expect((await sql<{ refund_cents: number }>("select refund_cents from purchases where id = $1", [pay.id]))[0].refund_cents).toBe(5000);

  await page.goto(`/dashboard/receipts/${pay.id}`);
  await expect(page.getByText(/Refunded on/)).toBeVisible();

  const res = await page.request.get(`/admin/payments/export?q=${receipt}`); // no status: must default to all
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("text/csv");
  const csv = await res.text();
  expect(csv).toContain(receipt);
  expect(csv).toContain('"refunded"');
  expect(csv).toContain('"129.00","50.00","79.00"');

  // The waiting checkout shows up under its filter (no CHIP call in tests).
  await page.goto(`/admin/payments?status=pending&q=${encodeURIComponent(orgEmail)}`);
  await expect(page.getByText("Upgrade to Exclusive", { exact: true })).toBeVisible(); // the desktop row (the phone row is hidden)

  // Close an account: type the email, asks first, photos/drafts gone, details anonymised.
  await page.goto(`/admin/users/${gone.id}`);
  await page.getByLabel(`Type ${goneEmail} to confirm`).fill(goneEmail);
  await page.getByRole("button", { name: "Close this account" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Close account" }).click();
  await expect(page.getByText(/This account was closed/)).toBeVisible();
  const [closed] = await sql<{ email: string; drafts: number }>("select email, (select count(*)::int from events where owner_id = $1) drafts from users where id = $1", [gone.id]);
  expect(closed.email).toMatch(/@deleted\.invalid$/);
  expect(closed.drafts).toBe(0);

  // ADMIN_SHOTS=<folder>: full-page previews of the new admin pages, desktop and phone.
  const dir = process.env.ADMIN_SHOTS;
  if (dir) {
    for (const [name, size] of [["desk", { width: 1440, height: 900 }], ["phone", { width: 390, height: 844 }]] as const) {
      await page.setViewportSize(size);
      for (const [shot, url] of [["users", "/admin/users"], ["user", `/admin/users/${org.id}`], ["payments", "/admin/payments"], ["payment", `/admin/payments/${pay.id}`]]) {
        await page.goto(url);
        await page.waitForLoadState("networkidle");
        await page.screenshot({ path: `${dir}/admin-${shot}-${name}.png`, fullPage: true });
      }
    }
  }
});
