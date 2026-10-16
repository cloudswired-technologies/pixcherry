import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import pg from "pg";

// Audit probes (2026-10-16): each test proves or disproves one suspected problem.
// Local only.   PROBE=1 npx playwright test e2e/probe-audit.spec.ts

test.skip(!process.env.PROBE, "set PROBE=1");

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

async function login(page: Page, email: string, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a code" }).click();
  await page.getByLabel("Login code").fill("123456");
  await page.getByRole("button", { name: "Log in" }).click();
}

async function paidEvent(ownerEmail: string, plan = "premium") {
  const tag = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const [u] = await sql("insert into users (email) values ($1) on conflict (email) do update set email = excluded.email returning id", [ownerEmail]);
  const [e] = await sql(
    `insert into events (owner_id, slug, name, starts_at, ends_at, plan_id, plan_snapshot, paid_at, deletion_at)
     select $1, $2, 'Audit probe', now() - interval '1 hour', now() + interval '3 hours', p.id,
       jsonb_build_object('plan_id', p.id, 'code', p.code, 'name', p.name, 'price_cents', p.price_cents, 'limits', p.limits, 'features', p.features,
         'quality', json_build_object('name', q.name, 'max_px', q.max_px, 'jpeg_quality', q.jpeg_quality)),
       now(), now() + interval '3 hours' + make_interval(days => (p.limits->>'retention_days')::int)
     from plans p join quality_presets q on q.id = p.quality_preset_id where p.code = $3 returning id, slug, deletion_at`,
    [u.id, `audit-${tag}`, plan],
  );
  return { userId: u.id as string, ...(e as { id: string; slug: string; deletion_at: Date }) };
}

test("A. open redirect after login with next=/\\evil", async ({ page }) => {
  await login(page, `audit-a-${Date.now()}@example.com`, "/\\example.com/phish");
  await page.waitForTimeout(5000);
  console.log("A. landed on:", page.url());
});

test("B. a paid event's dates can be moved freely (reuse / keep forever)", async ({ page }) => {
  const email = `audit-b-${Date.now()}@example.com`;
  const ev = await paidEvent(email);
  await login(page, email, `/dashboard/events/${ev.id}/settings`);
  await expect(page.getByRole("button", { name: "Save changes" })).toBeVisible({ timeout: 60_000 });
  const local = (d: Date) => new Date(d.getTime() + 8 * 3600_000).toISOString().slice(0, 16);
  const start = new Date(Date.now() + 200 * 86400_000);
  await page.locator('input[name="starts_at"]').fill(local(start));
  await page.locator('input[name="ends_at"]').fill(local(new Date(start.getTime() + 5 * 3600_000)));
  await page.locator('input[name="name"]').fill("A different event next year");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Saved.")).toBeVisible({ timeout: 30_000 });
  const [after] = await sql("select name, starts_at, deletion_at from events where id = $1", [ev.id]);
  console.log(`B. deletion_at before ${new Date(ev.deletion_at).toISOString()} → after ${new Date(after.deletion_at).toISOString()} (name now "${after.name}")`);
});

test("C. a 1-use 100% promo code used twice at the same moment", async ({ browser }) => {
  const code = `AUD${Date.now().toString(36).toUpperCase().slice(-6)}`;
  await sql("insert into promo_codes (code, percent_off, max_uses) values ($1, 100, 1)", [code]);
  const run = async (n: number) => {
    const email = `audit-c${n}-${Date.now()}@example.com`;
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    const tag = Date.now().toString(36) + n;
    const [u] = await sql("insert into users (email) values ($1) returning id", [email]);
    const [e] = await sql("insert into events (owner_id, slug, name, starts_at, ends_at) values ($1, $2, 'Promo probe', now() + interval '1 day', now() + interval '1 day 5 hours') returning id", [u.id, `promo-${tag}`]);
    await login(p, email, `/dashboard/events/${e.id}/checkout`);
    const card = p.locator("div.rounded-3xl", { hasText: "Premium" }).first();
    await card.getByLabel("Promo code (optional)").fill(code.toLowerCase());
    return { p, card, ctx, eventId: e.id as string };
  };
  const [x, y] = await Promise.all([run(1), run(2)]);
  await Promise.all([x.card.getByRole("button", { name: /^Pay RM/ }).click(), y.card.getByRole("button", { name: /^Pay RM/ }).click()]);
  await Promise.all([x.p.waitForTimeout(8000), y.p.waitForTimeout(8000)]);
  const paid = await sql("select count(*)::int n from events where id = any($1::uuid[]) and paid_at is not null", [[x.eventId, y.eventId]]);
  const [promo] = await sql("select used_count, max_uses from promo_codes where code = $1", [code]);
  console.log(`C. events activated with the 1-use code: ${paid[0].n}; used_count ${promo.used_count} / max ${promo.max_uses}`);
  await x.ctx.close();
  await y.ctx.close();
});

test("D. per-IP limit: 300 phones on one venue Wi-Fi reading stats", async ({ request }) => {
  const ev = await paidEvent(`audit-d-${Date.now()}@example.com`);
  let ok = 0;
  let limited = 0;
  // 650 requests from one IP inside a minute (= 300 phones × ~2 stats calls).
  for (let i = 0; i < 65; i++) {
    const rs = await Promise.all(Array.from({ length: 10 }, () => request.get(`/api/e/${ev.slug}/stats`)));
    for (const r of rs) r.status() === 429 ? limited++ : ok++;
  }
  console.log(`D. stats from one IP: ${ok} ok, ${limited} refused (429)`);
});

test("G. after the storage period, what personal data is left?", async ({ request }) => {
  const ev = await paidEvent(`audit-g-${Date.now()}@example.com`);
  const [g] = await sql(
    "insert into guests (event_id, name, token_hash, ip_hash, net_hash, device_info) values ($1, 'Siti Aminah', md5(random()::text), 'iphash', 'nethash', '{\"s\":\"393x852\"}') returning id",
    [ev.id],
  );
  await sql("insert into photos (event_id, guest_id, content_type, declared_bytes, status, caption) values ($1, $2, 'image/jpeg', 1000, 'ready', 'Me and my sister')", [ev.id, g.id]);
  await sql("update events set deletion_at = now() - interval '1 minute' where id = $1", [ev.id]);
  const secret = ENV.match(/^CRON_SECRET=(.*)$/m)?.[1]?.trim() ?? "dev-only-CRON_SECRET-not-for-production-use";
  const r = await request.post("/api/cron/hourly", { headers: { authorization: `Bearer ${secret}` } });
  const [left] = await sql(
    `select (select purged_at is not null from events where id = $1) purged,
       (select count(*)::int from guests where event_id = $1) guests,
       (select string_agg(name, ',') from guests where event_id = $1) names,
       (select count(*)::int from guests where event_id = $1 and device_info is not null) with_device,
       (select string_agg(caption, ',') from photos where event_id = $1 and caption is not null) captions`,
    [ev.id],
  );
  console.log(`G. cron ${r.status()}; after purge: ${JSON.stringify(left)}`);
});
