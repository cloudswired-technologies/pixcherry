import "server-only";
import { one, q } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { eventConfig, type EventConfigInput } from "@/lib/limits";

// How busy will the server be? For each paid event that is coming up or live,
// add up the guest capacity of every event whose time overlaps it (the event
// itself plus the first hours after it, when guests still share photos).
// The current server (1 vCPU) is comfortable up to about COMFORT_GUESTS at once.

export const COMFORT_GUESTS = 1000;
export const BUSY_GUESTS = 1500;
const AFTER_MS = 3 * 3600_000; // most sharing happens during and just after the event

export type Load = "ok" | "busy" | "over";
export type EventLoad = {
  id: string;
  name: string;
  starts_at: Date;
  ends_at: Date;
  guests: number;
  plan: string;
  email: string;
  overlaps: { id: string; name: string; guests: number }[];
  total: number;
  load: Load;
};

export const loadOf = (total: number): Load => (total > BUSY_GUESTS ? "over" : total > COMFORT_GUESTS ? "busy" : "ok");

type Row = EventConfigInput & { id: string; name: string; starts_at: Date; ends_at: Date; email: string };

export async function upcomingLoad(days = 60): Promise<EventLoad[]> {
  const rows = await q<Row>(
    `select e.id, e.name, e.starts_at, e.ends_at, e.plan_snapshot, e.addon_totals, e.overrides, u.email
     from events e join users u on u.id = e.owner_id
     where e.paid_at is not null and e.purged_at is null and not e.is_demo
       and e.ends_at > now() - interval '3 hours' and e.starts_at < now() + make_interval(days => $1)
     order by e.starts_at`,
    [days],
  );
  const span = rows.map((r) => ({
    id: r.id,
    name: r.name,
    starts_at: r.starts_at,
    ends_at: r.ends_at,
    email: r.email,
    plan: r.plan_snapshot?.name ?? "—",
    guests: eventConfig(r).limits.max_guests,
    s: new Date(r.starts_at).getTime(),
    e: new Date(r.ends_at).getTime() + AFTER_MS,
  }));
  return span.map(({ s, e, ...a }) => {
    const overlaps = span.filter((b) => b.id !== a.id && b.s < e && b.e > s).map((b) => ({ id: b.id, name: b.name, guests: b.guests }));
    const total = a.guests + overlaps.reduce((n, o) => n + o.guests, 0);
    return { ...a, overlaps, total, load: loadOf(total) };
  });
}

export type BusyWindow = { from: Date; to: Date; events: EventLoad[]; peak: number; load: Load };

// Group events that run at the same time (directly or through a chain) into one window.
export function busyWindows(events: EventLoad[]): BusyWindow[] {
  const items = events
    .map((e) => ({ e, s: new Date(e.starts_at).getTime(), t: new Date(e.ends_at).getTime() + AFTER_MS }))
    .sort((a, b) => a.s - b.s);
  const out: { s: number; t: number; events: EventLoad[] }[] = [];
  for (const it of items) {
    const last = out.at(-1);
    if (last && it.s < last.t) {
      last.t = Math.max(last.t, it.t);
      last.events.push(it.e);
    } else out.push({ s: it.s, t: it.t, events: [it.e] });
  }
  return out
    .filter((w) => w.events.length > 1)
    .map((w) => {
      const peak = Math.max(...w.events.map((e) => e.total));
      return { from: new Date(w.s), to: new Date(w.t - AFTER_MS), events: w.events.sort((a, b) => b.guests - a.guests), peak, load: loadOf(peak) };
    });
}

// Email the admins when an event newly enters the "too much" zone (each event once).
export async function alertOverload() {
  const over = (await upcomingLoad()).filter((e) => e.load === "over");
  if (!over.length) return 0;
  const seen = await one<{ value: { ids: string[] } }>("select value from settings where key = 'overload_alerted'");
  const known = new Set(seen?.value.ids ?? []);
  const fresh = over.filter((e) => !known.has(e.id));
  if (!fresh.length) return 0;
  const ids = [...new Set([...over.map((e) => e.id), ...known])].slice(0, 500);
  await q("insert into settings (key, value, updated_at) values ('overload_alerted', $1, now()) on conflict (key) do update set value = excluded.value, updated_at = now()", [JSON.stringify({ ids })]);
  const when = (d: Date) => new Date(d).toLocaleString("en-MY", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kuala_Lumpur" });
  const lines = fresh.map((e) => `• ${e.name} (${e.plan}, ${e.guests} guests) — ${when(e.starts_at)}, overlaps ${e.overlaps.map((o) => o.name).join(", ")}: up to ${e.total} guests at once`);
  const text = `Big PixCherry events will run at the same time:\n\n${lines.join("\n")}\n\nThe current server is comfortable up to ${COMFORT_GUESTS} guests at once. Consider a bigger server for that day, or watch the photo queue.\n\nAdmin: https://pixcherry.com/admin`;
  const admins = await q<{ email: string }>("select email from users where is_admin");
  for (const a of admins) {
    await sendEmail({ to: a.email, subject: `⚠️ PixCherry: big events overlap (${fresh.length})`, text, html: `<p>${text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\n/g, "<br>")}</p>`, template: "overload_alert" });
  }
  return fresh.length;
}
