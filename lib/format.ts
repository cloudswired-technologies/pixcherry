import { TZ } from "@/lib/env";

export function formatMoney(cents: number) {
  return `RM${(cents / 100).toLocaleString("en-MY", { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
}

export function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString("en-MY", { timeZone: TZ, day: "numeric", month: "short", year: "numeric" });
}

export function formatDateTime(d: Date | string) {
  return new Date(d).toLocaleString("en-MY", { timeZone: TZ, day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

/** "17 Oct 2026, 11:00 am – 5:00 pm" on one day, else both full dates. */
export function formatRange(start: Date | string, end: Date | string) {
  if (formatDate(start) !== formatDate(end)) return `${formatDateTime(start)} – ${formatDateTime(end)}`;
  const time = new Date(end).toLocaleTimeString("en-MY", { timeZone: TZ, hour: "numeric", minute: "2-digit" });
  return `${formatDateTime(start)} – ${time}`;
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
}

/** "2026-10-14T20:00" (datetime-local, Malaysia time) -> Date. */
export function parseLocalDateTime(s: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) return null;
  const d = new Date(`${s}:00+08:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Date -> "2026-10-14T20:00" in Malaysia time, for datetime-local inputs. */
export function toLocalInput(d: Date | string) {
  const t = new Date(new Date(d).getTime() + 8 * 3600_000);
  return t.toISOString().slice(0, 16);
}

/** Default times for a new event: next Saturday 11:00–17:00 Malaysia time. */
export function defaultEventTimes(nowMs = Date.now()) {
  const now = new Date(nowMs + 8 * 3600_000);
  const days = (6 - now.getUTCDay() + 7) % 7 || 7;
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + days, 11 - 8));
  return { start, end: new Date(start.getTime() + 6 * 3600_000) };
}

export function hoursSince(iso: string, nowMs = Date.now()) {
  return (nowMs - Date.parse(iso)) / 3600_000;
}
