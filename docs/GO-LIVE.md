# PixCherry — go-live status

Updated 2026-10-16 after the pre-launch audit. The site is live at pixcherry.com; real payments are the main thing left.

## Done

| What | Notes |
|---|---|
| Domain + Cloudflare | pixcherry.com, app.pixcherry.com (guests), img.pixcherry.com (R2) |
| Server | Vultr SG `ssh pixcherry`, Ubuntu 24.04, kernel 6.8.0-147 (rebooted 2026-10-16) |
| Server hardening | SSH key-only (`/etc/ssh/sshd_config.d/00-pixcherry-hardening.conf`), fail2ban on SSH, UFW: 80/443 from Cloudflare only, port 3000 closed from outside |
| Database | Supabase SG, migrations up to 0013; REST roles locked out of every table |
| R2 | Bucket `pixcherry-photos`, CORS for PUT, lifecycle `ev/` 400 days |
| Cron | hourly cleanup, 5-minute queue/overload alerts, nightly DB dump to `/var/backups/pixcherry/` (30 days) **and R2 `pixcherry-backups/db/`** (rclone remote `r2`, set up 2026-10-14; restore-tested 2026-10-16) |
| Edge cache | Cloudflare Page Rule `app.pixcherry.com/api/e/*/pulse` → cache everything (origin sends `s-maxage=3`) |
| Test data | Removed 2026-10-16 (events, photos, purchases, logs, test users). Backup before cleanup: `Diagnose\pixcherry-backups\` |
| Admins | shukryradzi@gmail.com, tech.pixcherry@gmail.com (email-code login) |

## Still to do (Shukry)

1. **CHIP live keys** — replace the TEST brand ID + secret in the server `.env` (`PLATFORM_CHIP_BRAND_ID`, `PLATFORM_CHIP_SECRET_KEY`), then one real payment end to end and refund it.
2. **Supabase Data API** — the app never uses it. Supabase → Project Settings → Data API → turn it off (or at least rotate the `service_role` key). Keys are in `Diagnose\pixcherry-dev-details.txt`.
3. **Root password** — SSH no longer accepts passwords, so the old root password only works in the Vultr web console. Change it there if it was ever shared.
4. **support@pixcherry.com** — the site and FAQ point people there; make sure the mailbox (or forward) exists.
5. **Real photos for the landing page** — the current demo photos are AI-generated; swap in real event photos when you have permission to use them (re-run the showcase, see README).
6. Real-phone check at a test event: an iPhone (HEIC) and an Android on 4G.
7. Terms + Privacy wording review.

## When to upgrade the server

Upgrade to Vultr 2 vCPU / 4 GB (~RM105/month) after ~10 paying Premium events, or as soon as the queue-alert email arrives during an event. Then set `WORKER_CONCURRENCY=2` and raise `COMFORT_GUESTS` / `BUSY_GUESTS` in `lib/capacity.ts`.

## Making the explainer video MP4

Playwright records WebM. The MP4 (for older iPhones) is made with ffmpeg, trimming the warm-up (`start` in `chapters.json`):

```bash
ffmpeg -ss <start> -i docs/screens/demo/video/guest.webm -vf "scale=720:-2" -c:v libx264 -profile:v main -crf 26 -preset slow -pix_fmt yuv420p -movflags +faststart -an docs/screens/demo/video/guest.mp4
```
