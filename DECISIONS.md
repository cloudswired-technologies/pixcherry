# PixCherry — how it is built and why

`EventSnap_MVP_Spec.md` is the original brief (working name EventSnap). The product has grown past its MVP non-goals (hearts, a film camera, AI checks); this file records what exists now and why. Last updated 2026-10-16.

## Stack

| Part | Choice | Why |
|---|---|---|
| App | Next.js 16 (App Router, TypeScript, Tailwind 4), `output: "standalone"` | One Node process on the VPS |
| Database | Postgres on Supabase (Singapore), used only as plain Postgres through `pg` from the server | No browser access to the DB. Supabase's REST API is not used; every table has RLS on and no `anon`/`authenticated` grants, and the default privileges are revoked so new tables start locked (migration 0013) |
| Organiser login | Email code (6 digits, expires, limited attempts) + signed session cookie | No passwords to leak or reset |
| Guests | No account. Signed per-event cookie + phone signals (screen, cores) + network hash | Lowest friction; a "same phone, other browser" guest is asked "is that you?" |
| Photo storage | Cloudflare R2, public custom domain `img.pixcherry.com` | Free egress, ~USD 0.015/GB-month |
| Image processing | Separate worker (`worker/worker.mjs`, systemd), queue = `photos` table with `FOR UPDATE SKIP LOCKED` | Upload bursts never slow the web process |
| Payments | CHIP, one-off purchases per event (still TEST keys until go-live) | Malaysian FPX + cards |
| Email | ZeptoMail | |
| Hosting | Vultr Singapore, 1 vCPU / 1 GB + 2.4 GB swap, Ubuntu 24.04, Caddy behind Cloudflare (Full strict, Origin CA) | Cheapest box that holds the app + worker; upgrade plan below |
| Hosts | `pixcherry.com` (site, dashboard, admin), `app.pixcherry.com/<slug>` (guest album; `proxy.ts` rewrites to `/e/<slug>`) | Short links on the QR card; the session cookie is shared so a host sees "Guest view · Host dashboard" |

## Upload pipeline

1. The phone resizes to **3072 px, JPEG 88** (one quality for every package: sharp enough to print, quick on venue Wi-Fi). HEIC is always converted.
2. `POST /api/e/<slug>/uploads` checks event state, guest quota, event quota, size/type and rate limits, reserves `photos` rows (`pending`) and returns presigned R2 PUT URLs.
3. The browser PUTs straight to R2 (`ev/<event>/in/<photo>`); bytes never pass through the server.
4. `POST …/uploads/<id>` marks it `uploaded`.
5. Worker: download → `sharp` (real-image check, auto-rotate, strip EXIF/GPS, pixel cap) → `full.jpg`, `md.webp` (1600 px), `sm.webp` (480 px) → **AI nudity check** on `sm` → status `ready`, or `review` when the AI hides it or the event approves every photo.
6. Pending rows not finished in an hour are released by the hourly job.

## Keeping albums clean

- **AI check** (`worker/moderate.mjs`): NSFWJS MobileNetV2 on TensorFlow.js WASM, runs in the worker, no external service. Porn+hentai ≥ 0.7 → hidden (`flag='ai'`); ≥ 0.4 or "sexy" ≥ 0.85 → stays visible, marked "AI: check". ~65 ms and ~100 MB per worker on the current box. Fails open: if the model can't load, uploads still go through. `WORKER_MODERATION=off` switches it off.
- **Guest reports**: a reported photo disappears for the reporter at once; 2 reports hide it for everyone (`flag='report'`). A photo the host approved is never hidden by reports again.
- Host: approve/delete per photo, block a guest, optional "approve every photo" mode (package feature).
- Only processed images are ever shown; uploads are never served as-is.

## Packages are data, not code

- `plans` hold price + every limit/feature as JSON; keys live in one registry (`lib/plan-schema.ts`) that also generates the admin forms.
- Photos per event is derived: guests × photos per guest (admins can override per event).
- On payment the plan is **snapshotted** into the event; later plan edits never change paid events. Effective settings = snapshot + paid add-ons, then admin overrides (`lib/limits.ts`).
- Live packages (2026-10-16): Free RM0 (30 guests × 10 photos, 3 days), Premium RM129 (300 × 20, 14 days, everything except branding), Exclusive RM299 (1000 × 30, 60 days, everything). Add-ons: +100 guests RM20, +10 photos per guest RM15, +30 days RM20.
- Upgrades mid-event pay the difference; promo codes (percent/fixed, expiry, max uses; 100% skips CHIP).

## Engagement (why there are more features than the MVP brief)

A shared folder gets few uploads; people share more when it's a game. Built: PixCamera (in-app camera, 12 film looks, zoom/focus/torch), snap missions, hashtags → albums, people pages, hearts + Top snappers, captions (printed under downloads), wishes wall, live slideshow, recap page + story card, optional guest selfie. Each can be switched per package.

## Retention

`deletion_at = event end + retention_days`. The hourly job emails a warning `warn_days` before, then deletes `ev/<event>/` in R2 and marks the event purged. An R2 lifecycle rule on `ev/` (400 days) is the backstop.

## Serving and downloads

- Gallery `sm.webp`, viewer `md.webp`, download `full.jpg` (captioned photos get the caption drawn underneath, with fonts as vector paths because Linux sharp has no text rendering).
- Album = streamed ZIP built from R2, folder per guest, max 4 at once; hosts can also tick photos.
- The album polls a tiny pulse endpoint every 6 s; Cloudflare caches it for 3 s (Page Rule `app.pixcherry.com/api/e/*/pulse`), so a full venue costs the server about one request per 3 s per event.

## Capacity and alerts

- The 1 vCPU box is comfortable up to ~1,000 guests online at once (worker ~1.5–2 photos/s). Upgrade to 2 vCPU / 4 GB (~RM105/month) after ~10 paying Premium events or when queue alerts start; then `WORKER_CONCURRENCY=2`.
- `/api/cron/queue` (every 5 min) emails admins if >200 photos wait or the oldest waits >3 min, and once per event when overlapping events go over 1,500 guests at once. The admin overview shows a 4-week "Server load ahead" calendar.

## Security

- Event links are readable slugs (organiser's choice) checked for availability; renamed links keep redirecting. Albums are `noindex`.
- Rate limits keyed on guest token (venue Wi-Fi shares an IP) plus loose IP limits; Turnstile on guest join and organiser login.
- Payments activate only after the CHIP callback signature is verified or the purchase is re-fetched as paid.
- Server: SSH key-only (no passwords, root by key), fail2ban on SSH, ports 80/443 open to Cloudflare only, the app port (3000) closed from outside, `.env` mode 600, deploys refuse to ship `.txt/.log/.env/key` files.

## Not built

Native apps, face recognition, video uploads, subscriptions, custom domains. UI is English; Bahasa Melayu later.
