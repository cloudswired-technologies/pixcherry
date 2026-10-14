#!/usr/bin/env bash
# Allow 80/443 only from Cloudflare (the site is always proxied). SSH rules are
# left untouched. Re-run any time to refresh Cloudflare's ranges.
#   ssh pixcherry 'bash -s' < deploy/firewall-cloudflare.sh
set -u
v4=$(curl -fsS https://www.cloudflare.com/ips-v4) || { echo "could not fetch ips-v4"; exit 1; }
v6=$(curl -fsS https://www.cloudflare.com/ips-v6) || { echo "could not fetch ips-v6"; exit 1; }
[ "$(echo "$v4" | wc -l)" -gt 5 ] || { echo "ips-v4 list looks wrong"; exit 1; }
for ip in $v4 $v6; do
  ufw allow proto tcp from "$ip" to any port 80,443 comment 'cloudflare' >/dev/null
done
ufw status | grep -c cloudflare | xargs echo "cloudflare rules:"
