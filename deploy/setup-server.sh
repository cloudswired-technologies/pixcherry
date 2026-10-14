#!/usr/bin/env bash
# One-time server setup (idempotent). Run as root on a fresh Ubuntu VPS:
#   ssh pixcherry 'bash -s' < deploy/setup-server.sh
# Installs Node 24, Caddy, pg_dump 17, rclone; creates the "pixcherry" user,
# folders, hourly cron and nightly DB backup. Firewall/SSH hardening is done
# separately (see the Diagnose hardening playbook) and needs explicit approval.
set -u
APP=/home/pixcherry/app

# Swap: the 1-2 GB plans need a cushion for image bursts.
if ! swapon --show | grep -q .; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  sysctl -q vm.swappiness=10 && echo 'vm.swappiness=10' > /etc/sysctl.d/99-pixcherry.conf
fi

id pixcherry >/dev/null 2>&1 || useradd -m -s /bin/bash pixcherry
mkdir -p $APP/releases /home/pixcherry/worker /var/log/caddy /var/backups/pixcherry /etc/caddy/certs
chown -R pixcherry:pixcherry $APP /home/pixcherry/worker
chmod 750 $APP

if ! command -v node >/dev/null || ! node -v | grep -q '^v24\.'; then
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash - >/dev/null
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq nodejs >/dev/null
fi
if ! command -v caddy >/dev/null; then
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https curl >/dev/null
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq caddy >/dev/null
fi
if ! command -v pg_dump >/dev/null || ! pg_dump --version | grep -q ' 17\.'; then
  install -d /usr/share/postgresql-common/pgdg
  curl -fsSo /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc https://www.postgresql.org/media/keys/ACCC4CF8.asc
  echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt $(. /etc/os-release; echo $VERSION_CODENAME)-pgdg main" > /etc/apt/sources.list.d/pgdg.list
  apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq postgresql-client-17 >/dev/null
fi
# rclone from rclone.org (Ubuntu's 1.60 gets 501 NotImplemented from R2).
if ! command -v rclone >/dev/null || rclone version | head -1 | grep -q 'v1\.[0-6][0-9]\.'; then
  V=$(curl -fsS https://downloads.rclone.org/version.txt | awk '{print $2}')
  curl -fsSL -o /tmp/rclone.deb "https://downloads.rclone.org/$V/rclone-$V-linux-amd64.deb"
  curl -fsSL "https://downloads.rclone.org/$V/SHA256SUMS" | grep " rclone-$V-linux-amd64.deb\$" | sed "s#rclone-$V-linux-amd64.deb#/tmp/rclone.deb#" | sha256sum -c - \
    && dpkg -i /tmp/rclone.deb >/dev/null
  rm -f /tmp/rclone.deb
fi

# The log dir is created above, before Caddy exists; Caddy must own it.
chown -R caddy:caddy /var/log/caddy
if [ -e $APP/current/deploy/Caddyfile ] && [ -e /etc/caddy/certs/origin.pem ]; then
  install -m 644 $APP/current/deploy/Caddyfile /etc/caddy/Caddyfile
  chgrp caddy /etc/caddy/certs /etc/caddy/certs/* && chmod 750 /etc/caddy/certs && chmod 640 /etc/caddy/certs/*
  # Validate as caddy: run as root it creates a root-owned log and reload fails.
  sudo -u caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile && systemctl reload caddy
fi

# Hourly: retention/deletion, warnings, stale uploads. 03:00 MYT: DB backup.
cat > /etc/cron.d/pixcherry <<'CRON'
SHELL=/bin/bash
5 * * * * root curl -fsS -m 600 -X POST -H "Authorization: Bearer $(grep -E '^CRON_SECRET=' /home/pixcherry/app/.env | cut -d= -f2-)" http://127.0.0.1:3000/api/cron/hourly >> /var/log/pixcherry-cron.log 2>&1
0 19 * * * root bash /home/pixcherry/app/current/deploy/backup.sh >> /var/log/pixcherry-backup.log 2>&1
CRON
chmod 644 /etc/cron.d/pixcherry
echo "setup ok"
