# PixCherry

Guests scan one QR code, snap and upload photos from their phones, and everything lands in one event album. Organisers pay once per event; photos are deleted automatically after the package's storage period.

Live: https://pixcherry.com (site, dashboard, admin) · guest albums at https://app.pixcherry.com/<event-link>

- Original brief: `EventSnap_MVP_Spec.md` (working name EventSnap)
- How it's built and why: `DECISIONS.md`
- Going live / what's still open: `docs/GO-LIVE.md`

## Run locally

```bash
npm install
cp .env.example .env.local      # local DATABASE_URL, ADMIN_EMAILS, DEV_FIXED_LOGIN_CODE=123456
npm run db:local                 # terminal 1: embedded Postgres on :54329 (no Docker)
npm run db:migrate
npm run dev                      # terminal 2: http://localhost:3000
npm run worker                   # terminal 3: image worker (+ AI check)
```

Without R2 settings, photos are stored in `.local-storage/` and served by `/api/dev-storage`.
To see the live packages locally: `PROD_DATABASE_URL=… node scripts/sync-plans-local.mjs` (reads prod, writes only the local DB).

## Tests

```bash
npm run typecheck && npm run lint          # tsc also checks e2e/
npm run e2e                                # flow, api, engage, social, moderation (dev server + worker running, uses installed Edge)
ATOZ=1 npx playwright test e2e/atoz.spec.ts  # every screen on a phone, layout checks → docs/screens/atoz-*
node worker/moderate.test.mjs              # AI check: plain photo passes; WORKER_NSFW_HIDE=0 must hide it
npm run load-test -- 20 10 5 30            # events, guests, photos each, concurrency
```

### Showcase run, screenshots and the explainer video

```bash
node scripts/split-collage.mjs e2e/.fixtures/collage.png e2e/.fixtures/photos 3   # 24 demo photos from a 4×6 collage
DEMO=1  npx playwright test e2e/demo.spec.ts    # wedding + conference albums end to end → docs/screens/demo/*.png
VIDEO=1 npx playwright test e2e/video.spec.ts   # guest walkthrough recording → docs/screens/demo/video/
node scripts/landing-assets.mjs                 # → public/landing/*.webp (+ video) used by / and /guide
```

The demo camera plays a real photo through Chromium's fake webcam (`--use-file-for-fake-video-capture`). The video's MP4 is made from the WebM with ffmpeg (see `docs/GO-LIVE.md`).

## Deploy

`node scripts/deploy.mjs` — builds, uploads a release, switches with health check and automatic rollback. Never in the same command as a commit. Migrations on prod: `DATABASE_URL=<prod> node scripts/db.mjs migrate` (additive migrations first, then deploy).

## Where things are

| Path | What |
|---|---|
| `lib/plan-schema.ts` | Every package limit/feature (admin forms are generated from it) |
| `lib/limits.ts` | Effective event settings: plan snapshot + add-ons + admin overrides |
| `lib/photos.ts`, `app/api/e/[slug]/uploads` | Upload reservation (quotas), gallery, reports |
| `lib/client/compress.ts`, `lib/client/uploader.ts`, `lib/client/photo-quality.ts` | Phone-side resize + upload queue |
| `app/e/[slug]/camera.tsx`, `lib/client/glfx.ts` | PixCamera and film looks (loaded only when a guest snaps) |
| `worker/worker.mjs`, `worker/moderate.mjs` | Image processing (sharp) and the AI nudity check |
| `lib/jobs.ts`, `app/api/cron/*` | Hourly retention/warnings/cleanup; 5-minute queue + overload alerts |
| `lib/capacity.ts` | "Server load ahead" (overlapping events) |
| `lib/payments.ts` | CHIP purchases, upgrades, add-ons, promo codes |
| `app/(site)` | Landing, guide, login, terms, privacy |
| `app/admin` | Platform admin |
| `deploy/`, `scripts/deploy.mjs` | VPS setup, systemd, Caddy, backups, deploy with rollback |
