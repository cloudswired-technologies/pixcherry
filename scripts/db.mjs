// Run SQL against the Supabase database.
//   node scripts/db.mjs ping
//   node scripts/db.mjs migrate          -> applies supabase/migrations/*.sql not yet recorded
//   node scripts/db.mjs file <path.sql>  -> runs one file
// Connection: DATABASE_URL from .env.local (session pooler, port 5432).
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

function loadEnv() {
  if (!existsSync(".env.local")) return;
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
}

loadEnv();
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL missing (.env.local)");
  process.exit(1);
}

const local = /@(127.0.0.1|localhost)[:/]/.test(url);
const client = new pg.Client({ connectionString: url, ssl: local ? false : { rejectUnauthorized: false } });
const [cmd, arg] = process.argv.slice(2);
client.on("notice", (n) => console.log(n.message));

await client.connect();
try {
  if (cmd === "ping") {
    const r = await client.query("select version(), current_database(), now()");
    console.log(r.rows[0]);
  } else if (cmd === "file") {
    await client.query(readFileSync(arg, "utf8"));
    console.log("ok", arg);
  } else if (cmd === "test") {
    // Each test file prints PASS/FAIL notices and a final "failed: N".
    let failed = 0;
    client.removeAllListeners("notice");
    client.on("notice", (n) => {
      const m = n.message.match(/^failed: (\d+)$/);
      if (m) failed += Number(m[1]);
      else console.log(n.message);
    });
    for (const f of readdirSync("supabase/tests").filter((f) => f.endsWith(".sql")).sort()) {
      console.log(`-- ${f}`);
      await client.query(readFileSync(join("supabase/tests", f), "utf8"));
    }
    console.log(failed ? `\n${failed} failed` : "\nall passed");
    if (failed) process.exitCode = 1;
  } else if (cmd === "migrate") {
    await client.query(
      "create table if not exists public._migrations (name text primary key, applied_at timestamptz not null default now())",
    );
    await client.query("revoke all on public._migrations from anon, authenticated");
    const done = new Set((await client.query("select name from public._migrations")).rows.map((r) => r.name));
    const dir = "supabase/migrations";
    const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
    for (const f of files) {
      if (done.has(f)) continue;
      const sql = readFileSync(join(dir, f), "utf8");
      await client.query("begin");
      try {
        await client.query(sql);
        await client.query("insert into public._migrations(name) values ($1)", [f]);
        await client.query("commit");
        console.log("applied", f);
      } catch (e) {
        await client.query("rollback");
        console.error("FAILED", f, "-", e.message);
        process.exitCode = 1;
        break;
      }
    }
    console.log("migrations up to date");
  } else {
    console.error("usage: node scripts/db.mjs ping|migrate|test|file <path>");
    process.exitCode = 1;
  }
} finally {
  await client.end();
}
