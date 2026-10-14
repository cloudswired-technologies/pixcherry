// Local Postgres for development and tests (no Docker needed).
//   node scripts/local-db.mjs        -> starts on port 54329, Ctrl+C to stop
// Data lives in .local-db/ (gitignored). DATABASE_URL for .env.local:
//   postgres://postgres:postgres@127.0.0.1:54329/pixcherry
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";

const dir = ".local-db";
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  user: "postgres",
  password: "postgres",
  port: 54329,
  persistent: true,
  // Same as Supabase: UTF-8 regardless of the Windows locale.
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
});

const fresh = !existsSync(`${dir}/PG_VERSION`);
if (fresh) await pg.initialise();
await pg.start();
if (fresh) {
  await pg.createDatabase("pixcherry");
  // Same API roles as Supabase, so migrations behave identically.
  const c = pg.getPgClient("pixcherry");
  await c.connect();
  await c.query("create role anon nologin; create role authenticated nologin;");
  await c.end();
}
console.log("local postgres ready: postgres://postgres:postgres@127.0.0.1:54329/pixcherry");

const stop = async () => {
  await pg.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
setInterval(() => {}, 1 << 30);
