// Build for production and ship to the VPS (ssh alias "eventsnap").
//   node scripts/deploy.mjs              build + upload + switch + health check (auto-rollback)
//   node scripts/deploy.mjs --no-build   reuse a build made by THIS script (never after a local `next build`)
//
// Server layout: /home/eventsnap/app/{releases/<ts>, current -> releases/<ts>, .env}
//                /home/eventsnap/worker (image worker, own node_modules)
// Run migrations first when there are new ones: node scripts/db.mjs migrate (with the production DATABASE_URL).
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const HOST = process.env.DEPLOY_HOST ?? "eventsnap";
const APP_URL = process.env.DEPLOY_APP_URL ?? "https://eventsnap.my";
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: "inherit", ...opts });
const ssh = (script) => execFileSync("ssh", [HOST, "bash -s"], { input: script.replace(/\r/g, ""), stdio: ["pipe", "inherit", "inherit"] });

if (!process.argv.includes("--no-build")) {
  console.log(`> building for ${APP_URL}`);
  rmSync(".next/cache", { recursive: true, force: true });
  run(process.platform === "win32" ? "npx.cmd" : "npx", ["next", "build"], {
    env: {
      ...process.env,
      APP_URL,
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.DEPLOY_TURNSTILE_SITE_KEY ?? "",
      NODE_ENV: "production",
    },
    shell: process.platform === "win32",
  });
}

const standalone = ".next/standalone";
if (!existsSync(join(standalone, "server.js"))) throw new Error("No standalone build found");

const stage = join(tmpdir(), `eventsnap-release-${Date.now()}`);
mkdirSync(stage, { recursive: true });
cpSync(standalone, stage, { recursive: true });
cpSync(".next/static", join(stage, ".next/static"), { recursive: true });
if (existsSync("public")) cpSync("public", join(stage, "public"), { recursive: true });
cpSync("deploy", join(stage, "deploy"), { recursive: true });
mkdirSync(join(stage, "worker"), { recursive: true });
for (const f of ["worker.mjs", "storage.mjs", "package.json", "package-lock.json"]) cpSync(join("worker", f), join(stage, "worker", f));
// Never ship local secrets or dev data.
for (const f of [".env", ".env.local", ".env.production", ".local-db", ".local-storage"]) rmSync(join(stage, f), { recursive: true, force: true });

const release = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "");
const tarball = join(tmpdir(), `eventsnap-${release}.tar.gz`);
console.log("> packing");
run("tar", ["-czf", tarball, "-C", stage, "."]);
rmSync(stage, { recursive: true, force: true });

console.log("> uploading");
run("scp", ["-q", tarball, `${HOST}:/tmp/eventsnap-${release}.tar.gz`]);
rmSync(tarball, { force: true });

console.log("> switching release");
ssh(`
set -u
APP=/home/eventsnap/app
REL=$APP/releases/${release}
PREV=$(readlink -f $APP/current 2>/dev/null || true)
mkdir -p $REL && tar -xzf /tmp/eventsnap-${release}.tar.gz -C $REL && rm -f /tmp/eventsnap-${release}.tar.gz
chown -R eventsnap:eventsnap $REL
chmod 750 $REL/deploy/*.sh
ln -sfn $REL $APP/current

# Worker: fixed folder; reinstall deps only when the lockfile changed.
W=/home/eventsnap/worker
install -d -m 750 -o eventsnap -g eventsnap $W
W_CHANGED=0
if ! cmp -s $REL/worker/package-lock.json $W/package-lock.json || [ ! -d $W/node_modules ]; then
  install -m 640 -o eventsnap -g eventsnap $REL/worker/package.json $REL/worker/package-lock.json $W/
  (cd $W && sudo -u eventsnap npm ci --omit=dev --no-audit --no-fund --loglevel=error) || { echo "worker npm ci failed"; exit 1; }
  W_CHANGED=1
fi
for f in worker.mjs storage.mjs; do
  cmp -s $REL/worker/$f $W/$f || { install -m 640 -o eventsnap -g eventsnap $REL/worker/$f $W/; W_CHANGED=1; }
done
for u in eventsnap eventsnap-worker; do
  if ! cmp -s $REL/deploy/$u.service /etc/systemd/system/$u.service; then
    install -m 644 $REL/deploy/$u.service /etc/systemd/system/$u.service
    systemctl daemon-reload
    systemctl enable $u >/dev/null 2>&1
    [ $u = eventsnap-worker ] && W_CHANGED=1
  fi
done

systemctl restart eventsnap
ok=0
for i in $(seq 1 30); do
  a=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/ || true)
  b=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/login || true)
  if [ "$a" = "200" ] && [ "$b" = "200" ]; then ok=1; break; fi
  sleep 1
done
if [ $ok = 1 ]; then
  if [ $W_CHANGED = 1 ] || ! systemctl is-active --quiet eventsnap-worker; then
    systemctl restart eventsnap-worker
    sleep 2
    systemctl is-active --quiet eventsnap-worker && echo "worker: up" || { echo "worker: NOT running"; journalctl -u eventsnap-worker -n 20 --no-pager; }
  else
    echo "worker: unchanged"
  fi
  echo "healthy: $REL"
  ls -1dt $APP/releases/* | tail -n +6 | xargs -r rm -rf
else
  echo "HEALTH CHECK FAILED, rolling back to $PREV"
  journalctl -u eventsnap -n 40 --no-pager
  if [ -n "$PREV" ]; then ln -sfn $PREV $APP/current; systemctl restart eventsnap; fi
  exit 1
fi
`);
console.log("> done");
