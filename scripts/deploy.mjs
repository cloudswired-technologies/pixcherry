// Build for production and ship to the VPS (ssh alias "pixcherry").
//   node scripts/deploy.mjs              build + upload + switch + health check (auto-rollback)
//   node scripts/deploy.mjs --no-build   reuse a build made by THIS script (never after a local `next build`)
//
// Server layout: /home/pixcherry/app/{releases/<ts>, current -> releases/<ts>, .env}
//                /home/pixcherry/worker (image worker, own node_modules)
// Run migrations first when there are new ones: node scripts/db.mjs migrate (with the production DATABASE_URL).
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const HOST = process.env.DEPLOY_HOST ?? "pixcherry";
const APP_URL = process.env.DEPLOY_APP_URL ?? "https://pixcherry.com";
// Guest pages live on their own host (app.pixcherry.com/<event>); the server .env sets it too.
const GUEST_URL = process.env.DEPLOY_GUEST_URL ?? "https://app.pixcherry.com";
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: "inherit", ...opts });
const ssh = (script) => execFileSync("ssh", [HOST, "bash -s"], { input: script.replace(/\r/g, ""), stdio: ["pipe", "inherit", "inherit"] });

if (!process.argv.includes("--no-build")) {
  console.log(`> building for ${APP_URL}`);
  rmSync(".next/cache", { recursive: true, force: true });
  run(process.platform === "win32" ? "npx.cmd" : "npx", ["next", "build"], {
    env: {
      ...process.env,
      APP_URL,
      GUEST_URL,
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.DEPLOY_TURNSTILE_SITE_KEY ?? "",
      NODE_ENV: "production",
    },
    shell: process.platform === "win32",
  });
}

const standalone = ".next/standalone";
if (!existsSync(join(standalone, "server.js"))) throw new Error("No standalone build found");

const stage = join(tmpdir(), `pixcherry-release-${Date.now()}`);
mkdirSync(stage, { recursive: true });
cpSync(standalone, stage, { recursive: true });
cpSync(".next/static", join(stage, ".next/static"), { recursive: true });
if (existsSync("public")) cpSync("public", join(stage, "public"), { recursive: true });
cpSync("deploy", join(stage, "deploy"), { recursive: true });
mkdirSync(join(stage, "worker"), { recursive: true });
for (const f of ["worker.mjs", "storage.mjs", "package.json", "package-lock.json"]) cpSync(join("worker", f), join(stage, "worker", f));
// Never ship local secrets or dev data.
for (const f of [".env", ".env.local", ".env.production", ".local-db", ".local-storage", "docs", "e2e", "test-results"]) rmSync(join(stage, f), { recursive: true, force: true });
// Last line of defence: refuse to ship anything that looks like credentials or local data
// (dev_details.txt once slipped into a release through Next's file tracing).
const forbidden = [];
(function scan(dir, rel = "") {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.name === "node_modules") continue;
    if (e.isDirectory()) scan(join(dir, e.name), r);
    else if (/\.(txt|log|pem|key)$|^\.env|dev_details|\.local-db|\.local-storage/i.test(r)) forbidden.push(r);
  }
})(stage);
if (forbidden.length) {
  rmSync(stage, { recursive: true, force: true });
  throw new Error(`Refusing to deploy, sensitive-looking files in the bundle:\n  ${forbidden.join("\n  ")}`);
}

const release = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "");
const tarball = join(tmpdir(), `pixcherry-${release}.tar.gz`);
console.log("> packing");
run("tar", ["-czf", tarball, "-C", stage, "."]);
rmSync(stage, { recursive: true, force: true });

console.log("> uploading");
run("scp", ["-q", tarball, `${HOST}:/tmp/pixcherry-${release}.tar.gz`]);
rmSync(tarball, { force: true });

console.log("> switching release");
ssh(`
set -u
APP=/home/pixcherry/app
REL=$APP/releases/${release}
PREV=$(readlink -f $APP/current 2>/dev/null || true)
mkdir -p $REL && tar -xzf /tmp/pixcherry-${release}.tar.gz -C $REL && rm -f /tmp/pixcherry-${release}.tar.gz
chown -R pixcherry:pixcherry $REL
chmod 750 $REL/deploy/*.sh
ln -sfn $REL $APP/current

# Worker: fixed folder; reinstall deps only when the lockfile changed.
W=/home/pixcherry/worker
install -d -m 750 -o pixcherry -g pixcherry $W
W_CHANGED=0
if ! cmp -s $REL/worker/package-lock.json $W/package-lock.json || [ ! -d $W/node_modules ]; then
  install -m 640 -o pixcherry -g pixcherry $REL/worker/package.json $REL/worker/package-lock.json $W/
  (cd $W && sudo -u pixcherry npm ci --omit=dev --no-audit --no-fund --loglevel=error) || { echo "worker npm ci failed"; exit 1; }
  W_CHANGED=1
fi
for f in worker.mjs storage.mjs; do
  cmp -s $REL/worker/$f $W/$f || { install -m 640 -o pixcherry -g pixcherry $REL/worker/$f $W/; W_CHANGED=1; }
done
for u in pixcherry pixcherry-worker; do
  if ! cmp -s $REL/deploy/$u.service /etc/systemd/system/$u.service; then
    install -m 644 $REL/deploy/$u.service /etc/systemd/system/$u.service
    systemctl daemon-reload
    systemctl enable $u >/dev/null 2>&1
    [ $u = pixcherry-worker ] && W_CHANGED=1
  fi
done

systemctl restart pixcherry
ok=0
for i in $(seq 1 30); do
  a=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/ || true)
  b=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/login || true)
  if [ "$a" = "200" ] && [ "$b" = "200" ]; then ok=1; break; fi
  sleep 1
done
if [ $ok = 1 ]; then
  if [ $W_CHANGED = 1 ] || ! systemctl is-active --quiet pixcherry-worker; then
    systemctl restart pixcherry-worker
    sleep 2
    systemctl is-active --quiet pixcherry-worker && echo "worker: up" || { echo "worker: NOT running"; journalctl -u pixcherry-worker -n 20 --no-pager; }
  else
    echo "worker: unchanged"
  fi
  echo "healthy: $REL"
  ls -1dt $APP/releases/* | tail -n +6 | xargs -r rm -rf
else
  echo "HEALTH CHECK FAILED, rolling back to $PREV"
  journalctl -u pixcherry -n 40 --no-pager
  if [ -n "$PREV" ]; then ln -sfn $PREV $APP/current; systemctl restart pixcherry; fi
  exit 1
fi
`);
console.log("> done");
