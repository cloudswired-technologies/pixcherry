# PixCherry — go-live checklist

Code is complete and tested locally (see README). These steps need accounts, money or DNS, so they are done together with Shukry.

## 1. Accounts and keys (Shukry)

| What | Where | Notes |
|---|---|---|
| Domain | pixcherry.com | ✅ Registered, zone on Cloudflare (2026-10-15) |
| Cloudflare zone | Add the domain to Cloudflare | Nameservers at the registrar |
| R2 bucket `pixcherry-photos` | Cloudflare → R2 | Location hint: APAC. Then: Settings → Custom domain `img.<domain>` |
| R2 API token | R2 → Manage API tokens | Object Read & Write, **this bucket only**. Save in `Diagnose\pixcherry-r2.txt` |
| R2 bucket `pixcherry-backups` | | For nightly DB dumps (optional but recommended) |
| Supabase project | Region **Singapore** | ✅ Created. Only used as Postgres; needs the session-pooler connection string |
| CHIP | Platform account (can reuse Cloudswired's) | Brand ID + secret key |
| ZeptoMail | Add domain, DKIM + bounce CNAME | `no-reply@<domain>` |
| Turnstile | Cloudflare → Turnstile | Widget for the domain |
| Vultr VPS | Singapore, High Performance 1 vCPU / 2 GB, **Ubuntu 24.04** | ~USD 12/month. Hostname must differ from the domain (e.g. `pixcherry-v1`). 1 GB works only with WORKER_CONCURRENCY=1 + swap |

## 2. R2 bucket settings

CORS (R2 → bucket → Settings → CORS policy), so phones can PUT directly:

```json
[
  {
    "AllowedOrigins": ["https://pixcherry.com"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["content-type"],
    "MaxAgeSeconds": 3600
  }
]
```

Lifecycle rules (backstop if the hourly cron ever stops):
- prefix `ev/` → delete after **400 days** (longer than the longest package's retention; raise if a package keeps photos longer)
- prefix `ev/` with `/in/` incoming uploads are cleaned by the app; no rule needed.

## 3. Server (Claude, with approval for each risky step)

1. `~/.ssh/id_ed25519_pixcherry` + alias `pixcherry` in `~/.ssh/config`.
2. Before first reboot: `touch /etc/cloud/cloud-init.disabled` (Ubuntu 26.04 hang).
3. `ssh pixcherry 'bash -s' < deploy/setup-server.sh`
4. Write `/home/pixcherry/app/.env` (from `.env.example`, mode 600, owner pixcherry).
5. Cloudflare Origin CA cert → `/etc/caddy/certs/origin.pem|key`; SSL mode Full (strict).
6. Firewall: 80/443 from Cloudflare IPs only, SSH key-only (hardening playbook).
7. `DATABASE_URL=<prod> node scripts/db.mjs migrate`
8. `node scripts/deploy.mjs`
9. Log in with an `ADMIN_EMAILS` address → Admin → Packages / Settings: set real prices and company details.

## 4. Before taking real money

- One real CHIP payment end to end, then refund it manually.
- Upload from a real iPhone (HEIC) and Android on 4G at a test event.
- Check `/admin` shows "Last cleanup" within the hour (cron running).
- Terms + Privacy reviewed (template wording now).
