import { expect, test, type APIRequestContext } from "@playwright/test";
import { readFileSync } from "node:fs";
import pg from "pg";
import sharp from "sharp";

// Abuse paths that the normal UI never takes: a script calling the API directly.

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

/** A paid event straight in the DB (Basic snapshot, 3 photos per guest). */
async function makeEvent() {
  const slug = `t${Math.random().toString(36).slice(2, 11)}`.replace(/[^a-z0-9]/g, "a").slice(0, 10).padEnd(10, "a");
  const [u] = await sql("insert into users (email) values ($1) returning id", [`api-${Date.now()}@example.com`]);
  const [p] = await sql(
    "select p.id, p.code, p.name, p.price_cents, p.limits, p.features, json_build_object('name', q.name, 'max_px', q.max_px, 'jpeg_quality', q.jpeg_quality) as quality from plans p join quality_presets q on q.id = p.quality_preset_id where p.code = 'basic'",
  );
  const snap = { plan_id: p.id, code: p.code, name: p.name, price_cents: p.price_cents, quality: p.quality, limits: p.limits, features: p.features };
  const [e] = await sql(
    `insert into events (owner_id, slug, name, starts_at, ends_at, plan_id, plan_snapshot, paid_at, deletion_at, overrides)
     values ($1, $2, 'API test', now(), now() + interval '5 hours', $3, $4, now(), now() + interval '8 days', $5) returning id`,
    [u.id, slug, p.id, JSON.stringify(snap), JSON.stringify({ limits: { photos_per_guest: 3 } })],
  );
  return { id: e.id as string, slug };
}

async function reserve(request: APIRequestContext, slug: string, files: { type: string; size: number }[]) {
  const r = await request.post(`/api/e/${slug}/uploads`, { data: { files } });
  return { status: r.status(), body: await r.json() };
}

test("API rejects bad uploads and frees quota", async ({ browser, request }) => {
  const ev = await makeEvent();

  // Not joined → 401
  const anon = await reserve(request, ev.slug, [{ type: "image/jpeg", size: 1000 }]);
  expect(anon.status).toBe(401);

  // Join via the page (sets the guest cookie in this context)
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`/e/${ev.slug}`);
  await page.getByRole("button", { name: "Start sharing photos" }).click();
  await expect(page.getByText("You can add 3 more photos.")).toBeVisible();
  const api = page.request;

  // Wrong type and oversize
  expect((await reserve(api, ev.slug, [{ type: "image/svg+xml", size: 1000 }])).status).toBe(409);
  expect((await reserve(api, ev.slug, [{ type: "image/jpeg", size: 200 * 1024 * 1024 }])).status).toBe(409);

  // Reserve 1 slot, PUT junk with the right length/type → worker must reject it and give the slot back
  const junk = Buffer.from("not really a jpeg ".repeat(20));
  const r1 = await reserve(api, ev.slug, [{ type: "image/jpeg", size: junk.length }]);
  expect(r1.status).toBe(200);
  const u1 = r1.body.uploads[0];
  // Tampered length or type is refused by storage
  expect((await api.put(u1.url, { data: Buffer.concat([junk, Buffer.from("x")]), headers: { "content-type": "image/jpeg" } })).status()).not.toBe(200);
  expect((await api.put(u1.url, { data: junk, headers: { "content-type": "image/png" } })).status()).not.toBe(200);
  expect((await api.put(u1.url, { data: junk, headers: { "content-type": "image/jpeg" } })).status()).toBe(200);
  expect((await api.post(`/api/e/${ev.slug}/uploads/${u1.id}`)).status()).toBe(200);
  await expect
    .poll(async () => (await sql("select status from photos where id = $1", [u1.id]))[0].status, { timeout: 20_000 })
    .toBe("rejected");
  const [g] = await sql("select upload_count from guests where event_id = $1", [ev.id]);
  expect(g.upload_count).toBe(0);

  // Quota: asking for 5 grants 3, then nothing
  const img = await sharp({ create: { width: 64, height: 64, channels: 3, background: "#888" } }).jpeg().toBuffer();
  const r2 = await reserve(api, ev.slug, Array.from({ length: 5 }, () => ({ type: "image/jpeg", size: img.length })));
  expect(r2.status).toBe(200);
  expect(r2.body.uploads).toHaveLength(3);
  expect(r2.body.refused).toBe(2);
  expect((await reserve(api, ev.slug, [{ type: "image/jpeg", size: img.length }])).status).toBe(409);

  // Someone else's photo id cannot be confirmed
  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await otherPage.goto(`/e/${ev.slug}`);
  await otherPage.getByRole("button", { name: "Start sharing photos" }).click();
  await expect(otherPage.getByText("You can add 3 more photos.")).toBeVisible();
  expect((await otherPage.request.post(`/api/e/${ev.slug}/uploads/${r2.body.uploads[0].id}`)).status()).toBe(409);

  // Cron without the secret is refused
  expect((await request.post("/api/cron/hourly")).status()).toBe(401);
  // Dashboard and admin need a session
  const dash = await request.get("/dashboard", { maxRedirects: 0 });
  expect(dash.status()).toBe(307);
  expect((await request.get(`/api/events/${ev.id}/qr`)).status()).toBe(401);

  await ctx.close();
  await other.close();
});
