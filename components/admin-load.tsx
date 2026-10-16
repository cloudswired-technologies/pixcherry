import Link from "next/link";
import { Gauge } from "lucide-react";
import { Card, cn } from "@/components/ui";
import { BUSY_GUESTS, busyWindows, COMFORT_GUESTS, loadOf, type EventLoad, type Load } from "@/lib/capacity";

const TZ = "Asia/Kuala_Lumpur";
const MAX_ROWS = 8;
const dayKey = (d: Date | string) => new Date(d).toLocaleDateString("en-CA", { timeZone: TZ });
const DAY_TONE: Record<Load, string> = { ok: "bg-ok-soft text-ok", busy: "bg-warn-soft text-warn", over: "bg-danger text-white" };
const TAG: Record<Load, { label: string; cls: string }> = {
  ok: { label: "OK", cls: "bg-ok-soft text-ok" },
  busy: { label: "Busy", cls: "bg-warn-soft text-warn" },
  over: { label: "Too much", cls: "bg-danger-soft text-danger" },
};

// Upcoming events on a 4-week calendar, coloured by the busiest moment of each day,
// plus every event that shares its time with others.
export function AdminLoad({ events }: { events: EventLoad[] }) {
  const peak = new Map<string, { total: number; n: number }>();
  for (const e of events) {
    const start = new Date(e.starts_at).getTime();
    const end = new Date(e.ends_at).getTime();
    const keys = new Set<string>();
    for (let t = start; t < end; t += 86_400_000) keys.add(dayKey(new Date(t)));
    keys.add(dayKey(new Date(end)));
    for (const k of keys) {
      const p = peak.get(k) ?? { total: 0, n: 0 };
      peak.set(k, { total: Math.max(p.total, e.total), n: p.n + 1 });
    }
  }
  const today = new Date();
  const weekday = (new Date(today.toLocaleString("en-US", { timeZone: TZ })).getDay() + 6) % 7; // 0 = Monday
  const monday = new Date(today.getTime() - weekday * 86_400_000);
  const days = Array.from({ length: 28 }, (_, i) => new Date(monday.getTime() + i * 86_400_000));
  const todayKey = dayKey(today);
  const windows = busyWindows(events);
  const worst = events.reduce((m, e) => Math.max(m, e.total), 0);
  const worstLoad = loadOf(worst);

  return (
    <Card className="rounded-3xl p-6">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Gauge className="size-5 text-brand" aria-hidden /> Server load ahead
        </h2>
        <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", TAG[worstLoad].cls)}>
          {worstLoad === "ok" ? "All clear" : worstLoad === "busy" ? "Busy days ahead" : "Overload risk"}
        </span>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Guests that can be online at the same time (events running together, plus 3 hours after each). The server is comfortable up to{" "}
        {COMFORT_GUESTS.toLocaleString("en-MY")}; above {BUSY_GUESTS.toLocaleString("en-MY")} uploads may queue.
      </p>

      <div className="grid grid-cols-7 gap-1.5 text-center">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="text-[11px] font-semibold text-muted-foreground">
            {d}
          </div>
        ))}
        {days.map((d) => {
          const k = dayKey(d);
          const p = peak.get(k);
          const past = k < todayKey;
          return (
            <div
              key={k}
              title={p ? `${p.n} event(s) · up to ${p.total.toLocaleString("en-MY")} guests at once` : undefined}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center rounded-xl px-0.5 py-1.5",
                p ? DAY_TONE[loadOf(p.total)] : "bg-canvas text-muted-foreground",
                past && "opacity-40",
                k === todayKey && "ring-2 ring-brand",
              )}
            >
              <span className="text-xs font-bold">{d.toLocaleDateString("en-MY", { day: "numeric", month: k.endsWith("-01") || k === dayKey(days[0]) ? "short" : undefined, timeZone: TZ })}</span>
              {p ? (
                <span className="text-[10px] font-semibold leading-tight">
                  {p.n} ev · {p.total >= 1000 ? `${(p.total / 1000).toFixed(1)}k` : p.total}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="size-2.5 rounded-full bg-ok" /> under {COMFORT_GUESTS.toLocaleString("en-MY")}</span>
        <span className="flex items-center gap-1"><span className="size-2.5 rounded-full bg-warn" /> busy</span>
        <span className="flex items-center gap-1"><span className="size-2.5 rounded-full bg-danger" /> over {BUSY_GUESTS.toLocaleString("en-MY")}</span>
      </div>

      <h3 className="mb-2 mt-5 text-sm font-bold">When events run at the same time</h3>
      {windows.length ? (
        <ul className="divide-y divide-border">
          {windows.slice(0, MAX_ROWS).map((w) => {
            const big = w.events[0];
            return (
              <li key={big.id + w.from.getTime()} className="flex items-center gap-3 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">
                    {w.from.toLocaleString("en-MY", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: TZ })} –{" "}
                    {w.to.toLocaleTimeString("en-MY", { hour: "numeric", minute: "2-digit", timeZone: TZ })}
                    <span className="font-normal text-muted-foreground"> · {w.events.length} events</span>
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    Biggest:{" "}
                    <Link href={`/admin/events/${big.id}`} className="font-semibold text-foreground hover:text-brand">
                      {big.name}
                    </Link>{" "}
                    ({big.plan}, {big.guests.toLocaleString("en-MY")} guests)
                    {w.events.length > 1 ? ` + ${w.events.slice(1, 3).map((e) => e.name).join(", ")}${w.events.length > 3 ? ` and ${w.events.length - 3} more` : ""}` : ""}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className={cn("block rounded-full px-2 py-0.5 text-xs font-semibold", TAG[w.load].cls)}>{TAG[w.load].label}</span>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">{w.peak.toLocaleString("en-MY")} at once</span>
                </span>
              </li>
            );
          })}
          {windows.length > MAX_ROWS ? (
            <li className="pt-2.5 text-xs text-muted-foreground">+ {windows.length - MAX_ROWS} more busy times later on</li>
          ) : null}
        </ul>
      ) : (
        <p className="rounded-2xl bg-canvas px-4 py-6 text-center text-sm text-muted-foreground">No upcoming events overlap. 👍</p>
      )}
    </Card>
  );
}
