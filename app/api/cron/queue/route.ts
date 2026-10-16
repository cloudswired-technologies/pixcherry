import { NextResponse } from "next/server";
import { safeEqual } from "@/lib/crypto";
import { one, q } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { secret } from "@/lib/env";

// Every 5 minutes (system cron): is the photo queue keeping up? If photos wait
// too long, email the admins — at most once every 30 minutes.

const MAX_WAITING = 200;
const MAX_WAIT_MIN = 3;

export async function POST(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  if (!safeEqual(auth, `Bearer ${secret("CRON_SECRET")}`)) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const s = await one<{ waiting: number; oldest_min: number | null }>(
    `select count(*)::int as waiting, round(extract(epoch from now() - min(uploaded_at)) / 60)::int as oldest_min
     from photos where status in ('uploaded','processing')`,
  );
  const waiting = s?.waiting ?? 0;
  const oldest = s?.oldest_min ?? 0;
  const bad = waiting > MAX_WAITING || oldest > MAX_WAIT_MIN;
  if (!bad) return NextResponse.json({ ok: true, waiting, oldest_min: oldest });
  const last = await one<{ value: { at: string } }>("select value from settings where key = 'last_queue_alert'");
  if (last && Date.now() - new Date(last.value.at).getTime() < 30 * 60_000) return NextResponse.json({ ok: false, waiting, oldest_min: oldest, alerted: false });
  await q("insert into settings (key, value, updated_at) values ('last_queue_alert', $1, now()) on conflict (key) do update set value = excluded.value, updated_at = now()", [
    JSON.stringify({ at: new Date().toISOString(), waiting, oldest }),
  ]);
  const admins = await q<{ email: string }>("select email from users where is_admin");
  const text = `PixCherry's photo queue is behind: ${waiting} photos waiting, the oldest for ${oldest} minutes.\n\nGuests see their photos late. Check the server (ssh pixcherry: systemctl status pixcherry-worker) or consider a bigger server.\n\nAdmin: https://pixcherry.com/admin`;
  for (const a of admins) {
    await sendEmail({ to: a.email, subject: `⚠️ PixCherry: ${waiting} photos waiting (${oldest} min)`, text, html: `<p>${text.replace(/\n/g, "<br>")}</p>`, template: "queue_alert" });
  }
  return NextResponse.json({ ok: false, waiting, oldest_min: oldest, alerted: true });
}
