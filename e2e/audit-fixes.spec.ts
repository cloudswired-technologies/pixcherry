import { expect, test, type Page } from "@playwright/test";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { readFileSync } from "node:fs";
import pg from "pg";
import sharp from "sharp";

// Fixes from the 2026-10-16 audit, each checked the way the problem was proven:
// a busy venue on one Wi-Fi IP, a one-time promo code used twice at once, guest data
// after the storage period, uploads the phone never confirmed, removing a guest
// mid-upload, and the recap of an unknown link.

const ENV = readFileSync(".env.local", "utf8");
const val = (k: string) => ENV.match(new RegExp(`^${k}=(.*)$`, "m"))?.[1]?.trim();
const DB = val("DATABASE_URL")!;
const SESSION_SECRET = val("SESSION_SECRET") || "dev-only-SESSION_SECRET-not-for-production-use";
const CRON_SECRET = val("CRON_SECRET") || "dev-only-CRON_SECRET-not-for-production-use";

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

async function paidEvent(ownerEmail: string) {
  const tag = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const [u] = await sql("insert into users (email) values ($1) on conflict (email) do update set email = excluded.email returning id", [ownerEmail]);
  const [e] = await sql(
    `insert into events (owner_id, slug, name, starts_at, ends_at, plan_id, plan_snapshot, paid_at, deletion_at)
     select $1, $2, 'Audit fixes', now() - interval '1 hour', now() + interval '3 hours', p.id,
       jsonb_build_object('plan_id', p.id, 'code', p.code, 'name', p.name, 'price_cents', p.price_cents,
         'limits', p.limits || '{"max_guests": 2000, "max_photos": 20000}'::jsonb, 'features', p.features,
         'quality', json_build_object('name', q.name, 'max_px', q.max_px, 'jpeg_quality', q.jpeg_quality)),
       now(), now() + interval '30 days'
     from plans p join quality_presets q on q.id = p.quality_preset_id where p.code = 'premium' returning id, slug`,
    [u.id, `fix-${tag}`],
  );
  return { userId: u.id as string, id: e.id as string, slug: e.slug as string };
}

/** A joined guest's signed cookie, as lib/guests.ts sets it. */
async function guestCookie(eventId: string, name: string) {
  const t = randomBytes(16).toString("base64url");
  const [g] = await sql("insert into guests (event_id, name, token_hash) values ($1, $2, $3) returning id", [eventId, name, createHash("sha256").update(t).digest("hex")]);
  const p = Buffer.from(JSON.stringify({ g: g.id, e: eventId, t })).toString("base64url");
  return { id: g.id as string, cookie: `pcg_${eventId.slice(0, 8)}=${p}.${createHmac("sha256", SESSION_SECRET).update(p).digest("base64url")}` };
}

test("a busy venue on one Wi-Fi IP: nobody is turned away", async ({ playwright }) => {
  test.setTimeout(600_000);
  const ev = await paidEvent(`fix-venue-${Date.now()}@example.com`);
  await sql("update events set guest_count = 400 where id = $1", [ev.id]);
  // 400 joined phones, all from this PC's single IP: stats twice, the gallery, one upload each.
  const guests = [];
  for (let i = 0; i < 400; i++) guests.push(await guestCookie(ev.id, `Venue guest ${i}`));
  const codes: Record<string, number> = {};
  const hit = async (cookie: string, path: string, method = "GET") => {
    const ctx = await playwright.request.newContext({ baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000", extraHTTPHeaders: { cookie } });
    const r =
      method === "GET"
        ? await ctx.get(path)
        : await ctx.post(path, { data: { files: [{ type: "image/jpeg", size: 50_000 }] } });
    codes[`${path.split("/").pop()} ${r.status()}`] = (codes[`${path.split("/").pop()} ${r.status()}`] ?? 0) + 1;
    await ctx.dispose();
  };
  for (let i = 0; i < guests.length; i += 25) {
    await Promise.all(
      guests.slice(i, i + 25).flatMap((g) => [
        hit(g.cookie, `/api/e/${ev.slug}/stats`),
        hit(g.cookie, `/api/e/${ev.slug}/stats`),
        hit(g.cookie, `/api/e/${ev.slug}/photos`),
        hit(g.cookie, `/api/e/${ev.slug}/uploads`, "POST"),
      ]),
    );
  }
  // And 700 looks from people who haven't joined yet (same IP).
  for (let i = 0; i < 700; i += 50) await Promise.all(Array.from({ length: 50 }, () => hit("", `/api/e/${ev.slug}/stats`)));
  console.log("venue:", JSON.stringify(codes));
  expect(Object.keys(codes).filter((k) => !k.endsWith(" 200"))).toEqual([]);
});

test("a one-time 100% promo code used twice at the same moment works once", async ({ browser }) => {
  const code = `FIX${Date.now().toString(36).toUpperCase().slice(-6)}`;
  await sql("insert into promo_codes (code, percent_off, max_uses) values ($1, 100, 1)", [code]);
  const run = async (n: number) => {
    const email = `fix-promo${n}-${Date.now()}@example.com`;
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    const [u] = await sql("insert into users (email) values ($1) returning id", [email]);
    const [e] = await sql("insert into events (owner_id, slug, name, starts_at, ends_at) values ($1, $2, 'Promo', now() + interval '1 day', now() + interval '1 day 5 hours') returning id", [
      u.id,
      `promo-${Date.now().toString(36)}${n}`,
    ]);
    await login(p, email, `/dashboard/events/${e.id}/checkout`);
    const card = p.locator("div.rounded-3xl", { hasText: "Premium" }).first();
    await card.getByLabel("Promo code (optional)").fill(code.toLowerCase());
    return { p, card, ctx, eventId: e.id as string };
  };
  const [x, y] = await Promise.all([run(1), run(2)]);
  await Promise.all([x.card.getByRole("button", { name: /^Pay RM/ }).click(), y.card.getByRole("button", { name: /^Pay RM/ }).click()]);
  await expect
    .poll(async () => (await sql("select count(*)::int n from purchases where event_id = any($1::uuid[]) and status <> 'pending'", [[x.eventId, y.eventId]]))[0].n, { timeout: 60_000 })
    .toBe(2);
  const [paid] = await sql("select count(*)::int n from events where id = any($1::uuid[]) and paid_at is not null", [[x.eventId, y.eventId]]);
  const [promo] = await sql("select used_count from promo_codes where code = $1", [code]);
  expect(paid.n).toBe(1);
  expect(promo.used_count).toBe(1);
  const refused = (await x.p.getByText("That promo code has just been used up.").count()) + (await y.p.getByText("That promo code has just been used up.").count());
  expect(refused).toBe(1);
  await x.ctx.close();
  await y.ctx.close();
});

test("after the storage period no one's personal data is left", async ({ request }) => {
  const ev = await paidEvent(`fix-purge-${Date.now()}@example.com`);
  const [g] = await sql(
    `insert into guests (event_id, name, token_hash, ip_hash, net_hash, addr_hash, device_info, avatar_key)
     values ($1, 'Siti Aminah', md5(random()::text), 'iphash', 'nethash', 'addrhash', '{"s":"393x852"}', 'ev/x/avatars/a.webp') returning id`,
    [ev.id],
  );
  const [ph] = await sql("insert into photos (event_id, guest_id, content_type, declared_bytes, status, caption, tags) values ($1, $2, 'image/jpeg', 1000, 'ready', 'Me and my sister', '{family}') returning id", [
    ev.id,
    g.id,
  ]);
  await sql("insert into photo_reports (photo_id, guest_id) values ($1, $2)", [ph.id, g.id]);
  await sql("update events set deletion_at = now() - interval '1 minute' where id = $1", [ev.id]);
  const r = await request.post("/api/cron/hourly", { headers: { authorization: `Bearer ${CRON_SECRET}` } });
  expect(r.status()).toBe(200);
  const [left] = await sql(
    `select (select purged_at is not null from events where id = $1) purged,
       (select count(*)::int from guests where event_id = $1) guests,
       (select count(*)::int from guests where event_id = $1 and (name is not null or device_info is not null or ip_hash is not null
          or net_hash is not null or addr_hash is not null or avatar_key is not null)) identifiable,
       (select count(*)::int from photos where event_id = $1 and (caption is not null or tags <> '{}')) captions,
       (select count(*)::int from photo_reports r join photos p on p.id = r.photo_id where p.event_id = $1) reports`,
    [ev.id],
  );
  expect(left).toEqual({ purged: true, guests: 1, identifiable: 0, captions: 0, reports: 0 });
});

test("an upload the phone never confirmed is still added; a slot never used is given back", async ({ request }) => {
  const ev = await paidEvent(`fix-stale-${Date.now()}@example.com`);
  const { id: guestId } = await guestCookie(ev.id, "Weak Wi-Fi");
  const [arrived] = await sql(
    "insert into photos (event_id, guest_id, content_type, declared_bytes, created_at) values ($1, $2, 'image/jpeg', 50000, now() - interval '2 hours') returning id",
    [ev.id, guestId],
  );
  const [never] = await sql(
    "insert into photos (event_id, guest_id, content_type, declared_bytes, created_at) values ($1, $2, 'image/jpeg', 50000, now() - interval '2 hours') returning id",
    [ev.id, guestId],
  );
  await sql("update guests set upload_count = 2 where id = $1", [guestId]);
  // The first photo reached storage (local driver), the phone just never said so.
  const dir = `.local-storage/ev/${ev.id}/in`;
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/${arrived.id}`, await sharp({ create: { width: 800, height: 600, channels: 3, background: "#e91d48" } }).jpeg().toBuffer());
  const r = await request.post("/api/cron/hourly", { headers: { authorization: `Bearer ${CRON_SECRET}` } });
  expect(r.status()).toBe(200);
  await expect.poll(async () => (await sql("select status from photos where id = $1", [arrived.id]))[0].status, { timeout: 60_000 }).toMatch(/uploaded|processing|ready/);
  expect((await sql("select status from photos where id = $1", [never.id]))[0].status).toBe("failed");
  expect((await sql("select upload_count from guests where id = $1", [guestId]))[0].upload_count).toBe(1);
});

test("removing a guest also drops their photos still on the way", async ({ page }) => {
  const email = `fix-remove-${Date.now()}@example.com`;
  const ev = await paidEvent(email);
  const { id: guestId } = await guestCookie(ev.id, "Troll");
  await sql("update events set guest_count = 1 where id = $1", [ev.id]);
  const [p] = await sql("insert into photos (event_id, guest_id, content_type, declared_bytes) values ($1, $2, 'image/jpeg', 50000) returning id", [ev.id, guestId]);
  await login(page, email, `/dashboard/events/${ev.id}/guests`);
  await page.getByRole("button", { name: "Remove Troll" }).click();
  await page.getByRole("alertdialog", { name: "Remove Troll?" }).getByRole("button", { name: "Remove guest" }).click();
  await expect(page.getByRole("button", { name: "Remove Troll" })).toHaveCount(0);
  expect((await sql("select status from photos where id = $1", [p.id]))[0].status).toBe("failed");
});

test("the recap of a link that doesn't exist is a real 404", async ({ request }) => {
  const r = await request.get(`/e/no-such-album-${Date.now().toString(36)}/recap`);
  expect(r.status()).toBe(404);
});
