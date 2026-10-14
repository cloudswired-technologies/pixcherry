# EventSnap

Guests scan one QR code, upload photos from their phones, and everything lands in one event album. Organisers pay once per event; photos are deleted automatically after the package's storage period.

- Product brief: `EventSnap_MVP_Spec.md`
- How it's built and why: `DECISIONS.md`
- Going live: `docs/GO-LIVE.md`

## Run locally

```bash
npm install
cp .env.example .env.local      # set DATABASE_URL to the local one, ADMIN_EMAILS, DEV_FIXED_LOGIN_CODE=123456
npm run db:local                 # terminal 1: embedded Postgres on :54329 (no Docker)
npm run db:migrate
npm run dev                      # terminal 2: http://localhost:3000
npm run worker                   # terminal 3: image worker
```

Without R2 settings, photos are stored in `.local-storage/` and served by `/api/dev-storage`.

## Tests

```bash
npm run typecheck && npm run lint
npm run e2e                      # dev server + worker running; uses installed Edge
SCREENS=1 npx playwright test e2e/screens.spec.ts   # screenshots → docs/screens
npm run load-test -- 20 10 5 30  # events, guests, photos each, concurrency
```

## Where things are

| Path | What |
|---|---|
| `lib/plan-schema.ts` | Every package limit/feature (admin forms are generated from it) |
| `lib/limits.ts` | Effective event settings: plan snapshot + add-ons + admin overrides |
| `lib/photos.ts`, `app/api/e/[slug]/uploads` | Upload reservation (quotas) and presigned URLs |
| `lib/client/compress.ts`, `lib/client/uploader.ts` | Phone-side resize + upload queue |
| `worker/worker.mjs` | Image processing (sharp) |
| `lib/jobs.ts` | Hourly retention, warnings, cleanup |
| `lib/payments.ts` | CHIP purchases, upgrades, add-ons, promo codes |
| `app/admin` | Platform admin |
| `deploy/`, `scripts/deploy.mjs` | VPS setup, systemd, Caddy, backups, deploy with rollback |
