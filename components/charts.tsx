import type { LucideIcon } from "lucide-react";
import { cn } from "@/components/ui";

// Small server-rendered charts for the dashboards: plain SVG, no library,
// nothing to download. Good enough for "how is it going" at a glance.

export function Delta({ now, prev, suffix = "vs previous 30 days" }: { now: number; prev: number; suffix?: string }) {
  if (!prev && !now) return <span className="text-xs text-muted-foreground">No activity yet</span>;
  if (!prev) return <span className="text-xs font-semibold text-ok">New · {suffix}</span>;
  const pct = Math.round(((now - prev) / prev) * 100);
  const up = pct >= 0;
  return (
    <span className="text-xs text-muted-foreground">
      <span className={cn("mr-1 rounded-full px-1.5 py-0.5 font-bold", up ? "bg-ok-soft text-ok" : "bg-danger-soft text-danger")}>
        {up ? "▲" : "▼"} {Math.abs(pct)}%
      </span>
      {suffix}
    </span>
  );
}

export function Sparkline({ values, className }: { values: number[]; className?: string }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${30 - (v / max) * 28}`).join(" ");
  return (
    <svg viewBox="0 0 100 32" preserveAspectRatio="none" className={cn("h-10 w-full", className)} aria-hidden>
      <polyline points={`0,32 ${pts} 100,32`} className="fill-brand/10" stroke="none" />
      <polyline points={pts} fill="none" className="stroke-brand" strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

export function Kpi({
  icon: Icon,
  label,
  value,
  sub,
  spark,
  tone = "brand",
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub?: React.ReactNode;
  spark?: number[];
  tone?: "brand" | "ok" | "amber" | "ink";
}) {
  const chip = { brand: "bg-brand-soft text-brand", ok: "bg-ok-soft text-ok", amber: "bg-[#fff1d6] text-[#b45309]", ink: "bg-muted text-ink" }[tone];
  return (
    <div className="flex flex-col gap-2 rounded-3xl border border-border bg-card p-5 shadow-soft">
      <div className="flex items-center gap-2.5">
        <span className={cn("grid size-9 place-items-center rounded-xl", chip)}>
          <Icon className="size-[18px]" aria-hidden />
        </span>
        <span className="text-sm font-semibold text-muted-foreground">{label}</span>
      </div>
      <div className="text-3xl font-extrabold tracking-tight">{value}</div>
      {sub ? <div>{sub}</div> : null}
      {spark ? <Sparkline values={spark} /> : null}
    </div>
  );
}

/** Vertical bars, one per day. Labels under the first, middle and last bar. */
export function Bars({ data, format = (n) => String(n), height = 160 }: { data: { label: string; value: number }[]; format?: (n: number) => string; height?: number }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const show = new Set([0, Math.floor((data.length - 1) / 2), data.length - 1]);
  return (
    <div>
      <div className="flex items-end gap-[3px]" style={{ height }}>
        {data.map((d, i) => (
          <div key={i} className="group relative flex h-full flex-1 items-end">
            <div
              className={cn("w-full rounded-t-md transition-colors", d.value ? "bg-brand/80 group-hover:bg-brand" : "bg-muted")}
              style={{ height: `${Math.max(d.value ? 4 : 2, (d.value / max) * 100)}%` }}
              title={`${d.label}: ${format(d.value)}`}
            />
            <span className="pointer-events-none absolute -top-7 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-1.5 py-0.5 text-[10px] font-semibold text-white group-hover:block">
              {format(d.value)}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex text-[10px] text-muted-foreground">
        {data.map((d, i) => (
          <span key={i} className="flex-1 text-center">
            {show.has(i) ? d.label : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

const DONUT = ["#e91d48", "#f59e0b", "#16a34a", "#6366f1", "#0ea5e9", "#a855f7"];

export function Donut({ parts, center }: { parts: { label: string; value: number }[]; center: string }) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  let acc = 0;
  const r = 15.9155; // circumference 100
  return (
    <div className="flex items-center gap-5">
      <svg viewBox="0 0 42 42" className="size-32 shrink-0 -rotate-90" aria-hidden>
        <circle cx="21" cy="21" r={r} fill="none" stroke="var(--muted)" strokeWidth="6" />
        {total
          ? parts.map((p, i) => {
              const len = (p.value / total) * 100;
              const el = <circle key={p.label} cx="21" cy="21" r={r} fill="none" stroke={DONUT[i % DONUT.length]} strokeWidth="6" strokeDasharray={`${len} ${100 - len}`} strokeDashoffset={-acc} />;
              acc += len;
              return el;
            })
          : null}
        <text x="21" y="21" className="rotate-90" />
      </svg>
      <div className="grid min-w-0 gap-1.5 text-sm">
        <div className="text-xs font-semibold text-muted-foreground">{center}</div>
        {parts.length ? (
          parts.map((p, i) => (
            <div key={p.label} className="flex items-center gap-2">
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: DONUT[i % DONUT.length] }} />
              <span className="min-w-0 flex-1 truncate">{p.label}</span>
              <span className="font-semibold">{p.value}</span>
            </div>
          ))
        ) : (
          <span className="text-muted-foreground">Nothing yet</span>
        )}
      </div>
    </div>
  );
}
