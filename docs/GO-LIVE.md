# EventSnap — go-live checklist

Code is complete and tested locally (see README). These steps need accounts, money or DNS, so they are done together with Shukry.

## 1. Accounts and keys (Shukry)

| What | Where | Notes |
|---|---|---|
| Domain | e.g. eventsnap.my | Check availability + name/trademark first ("EventSnap" is used by other apps abroad) |
| Cloudflare zone | Add the domain to Cloudflare | Nameservers at the registrar |
| R2 bucket `eventsnap-photos` | Cloudflare → R2 | Location hint: APAC. Then: Settings → Custom domain `img.<domain>` |
| R2 API token | R2 → Manage API tokens | Object Read & Write, **this bucket only**. Save in `Diagnose\eventsnap-r2.txt` |
| R2 bucket `eventsnap-backups` | | For nightly DB dumps (optional but recommended) |
| Supabase project | Region **Singapore** | Only used as Postgres. Copy the session-pooler connection string |
| CHIP | Platform account (can reuse Cloudswired's) | Brand ID + secret key |
| ZeptoMail | Add domain, DKIM + bounce CNAME | `no-reply@<domain>` |
| Turnstile | Cloudflare → Turnstile | Widget for the domain |
| Vultr VPS | Singapore, 2 GB (High Frequency), Ubuntu | ~USD 12/month. Hostname must differ from the domain (e.g. `eventsnap-v1`) |

## 2. R2 bucket settings

CORS (R2 → bucket → Settings → CORS policy), so phones can PUT directly:

```json
[
  {
    "AllowedOrigins": ["https://eventsnap.my"],
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

1. `~/.ssh/id_ed25519_eventsnap` + alias `eventsnap` in `~/.ssh/config`.
2. Before first reboot: `touch /etc/cloud/cloud-init.disabled` (Ubuntu 26.04 hang).
3. `ssh eventsnap 'bash -s' < deploy/setup-server.sh`
4. Write `/home/eventsnap/app/.env` (from `.env.example`, mode 600, owner eventsnap).
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
