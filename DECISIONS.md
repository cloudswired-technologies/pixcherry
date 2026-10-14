# EventSnap — Decisions

Agreed with Shukry on 2026-10-14. `EventSnap_MVP_Spec.md` is the product brief; this file records how it is built.

## Stack

| Part | Choice | Why |
|---|---|---|
| App | Next.js 16 (App Router, TypeScript, Tailwind 4), `output: "standalone"` | Same as SkillPass; one Node process on the VPS |
| Database | Postgres, hosted on Supabase (SG), accessed with `pg` from the server only | Metadata only (events, photos, payments). No browser access to the DB, so no RLS surface. Portable to any Postgres |
| Organiser login | Own email OTP code + signed session cookie | No Supabase Auth dependency; same pattern as SkillPass participant login |
| Guests | No account. Signed per-event device cookie (`guests` row) | Lowest friction; quota is counted per device |
| Photo storage | Cloudflare R2 (S3 API), public custom domain `img.<domain>` behind Cloudflare CDN | Free egress, ~USD 0.015/GB-month |
| Image processing | Separate worker process (`worker/worker.mjs`, systemd) using `sharp`, queue = `photos` table with `FOR UPDATE SKIP LOCKED` | Upload bursts never slow the web process |
| Payments | CHIP (platform account), one-off purchases | Same as SkillPass |
| Email | ZeptoMail | Same as SkillPass |
| Hosting | New Vultr SG VPS, 2 GB, Caddy + Cloudflare (Full strict, Origin CA) | Kept apart from SkillPass (its 1 GB box has ~410 MB free) |
| Scheduled jobs | `/api/cron/hourly` called by system cron with `CRON_SECRET` | Same as SkillPass |

## Upload pipeline

1. Phone resizes/compresses the photo to the event's quality preset (canvas → JPEG). HEIC is always converted. "Original" preset skips resizing.
2. `POST /api/e/<slug>/uploads` checks event state, guest quota, event quota, file size/type and rate limit, reserves the slots (`photos` rows, status `pending`) and returns one presigned R2 PUT URL per file (15 min, size + type signed).
3. Browser PUTs straight to R2 (`ev/<event>/in/<photo>`). File bytes never pass through our server.
4. `POST /api/e/<slug>/uploads/<id>/done` → status `uploaded`.
5. Worker: HEAD (size check) → download → `sharp` (decode = real image check, auto-rotate, strip EXIF/GPS, pixel limit) → `full.jpg` (preset quality), `md.webp` (1600 px), `sm.webp` (480 px) → deletes the incoming file → status `ready` (or `review` when the event uses moderation).
6. Pending rows not finished in 1 hour are released by the hourly cron.

## Packages are data, not code

- `plans`: price, quality preset, and every limit/feature in `limits` / `features` JSON. The list of keys lives in one registry (`lib/plan-schema.ts`); the admin form is generated from it, so a new setting = one registry entry.
- `quality_presets`: name, max long edge (px, empty = original), JPEG quality.
- `plan_addons`: extra retention days / photos per guest / photos per event / guests, each with a price.
- On payment the plan is **snapshotted** into the event. Editing a plan later never changes paid events.
- Effective limits = snapshot + paid add-ons, then admin per-event overrides win. Computed in one function (`lib/limits.ts`).
- Upgrade mid-event: pay the price difference, snapshot switches to the new plan, add-ons stay.
- Promo codes (percent or fixed, expiry, max uses, optional plan). A 100% code activates without CHIP.
- Global settings (warning days before deletion, rate limits, company details) in `settings`, editable by the admin.
- Every admin change is written to `audit_log`.

## Retention

`deletion_at = event end + retention_days` (from effective limits). Hourly cron: warning email `warn_days` before, then deletes the `ev/<event>/` prefix in R2 and marks the event purged. An R2 lifecycle rule on `ev/` (400 days, longer than any package keeps photos) is the backstop if cron ever fails.

## Serving and downloads

- Gallery uses `sm.webp`, viewer `md.webp`, download `full.jpg`, all from the CDN with unguessable keys.
- Album download = streamed ZIP (store, no compression) built on the server from R2, constant memory, max 4 at a time.
- Gallery refreshes by polling (no Supabase Realtime: connection limits).

## Security

- Event slug: 10 random chars (unguessable). "Regenerate QR" issues a new slug.
- Rate limits keyed on guest token (venue Wi-Fi shares one IP); loose IP limit as well. Turnstile on guest join and organiser login when keys are set.
- Only processed images are ever shown. Uploaded files are never served as-is.
- Payments activate only after the CHIP callback signature is verified or the purchase is re-fetched from CHIP as paid.

## Not built (per spec non-goals)

Native apps, AI, face recognition, comments/likes, subscriptions, custom domains, video. UI is English first; Bahasa Melayu later.
