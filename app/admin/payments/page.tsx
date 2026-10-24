import Link from "next/link";
import { CircleDollarSign, Download, HandCoins, ReceiptText, Search, Undo2 } from "lucide-react";
import { Bars, Delta, Kpi } from "@/components/charts";
import { Card, btn, cn } from "@/components/ui";
import { KIND_LABEL, PAYMENT_FILTERS, listPayments, monthRange, paymentCounts, paymentStats, type PaymentFilter } from "@/lib/admin-data";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime, formatMoney } from "@/lib/format";
import { PaymentStatus } from "./bits";

export const metadata = { title: "Payments" };

const rm = (cents: number) => formatMoney(cents).replace(/\.00$/, "");
const monthName = (m: string) => new Date(`${m}-01T00:00:00+08:00`).toLocaleDateString("en-MY", { month: "long", year: "numeric", timeZone: "Asia/Kuala_Lumpur" });

export default async function AdminPayments({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; month?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const term = (sp.q ?? "").trim().slice(0, 100);
  const status: PaymentFilter = sp.status && sp.status in PAYMENT_FILTERS ? (sp.status as PaymentFilter) : "all";
  const month = monthRange(sp.month);
  const [rows, counts, stats] = await Promise.all([listPayments({ filter: status, term, month }), paymentCounts(), paymentStats()]);
  const t = stats.totals;
  const query = (s: PaymentFilter) => new URLSearchParams({ status: s, ...(term ? { q: term } : {}), ...(month ? { month } : {}) }).toString();
  const kindTotal = stats.kinds.reduce((s, k) => s + k.value, 0);
  const shown = rows.reduce((s, p) => s + (p.status === "paid" ? p.amount_cents - (p.refund_cents ?? 0) : 0), 0);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Payments</h1>
          <p className="mt-1 text-sm text-muted-foreground">Every checkout on PixCherry. Refund the money in the CHIP dashboard, then record it on the payment here.</p>
        </div>
        <a href={`/admin/payments/export?${query(status)}`} className={btn("outline")}>
          <Download aria-hidden /> Download CSV
        </a>
      </div>

      <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Kpi icon={CircleDollarSign} label="This month" value={rm(t?.this_month ?? 0)} sub={<Delta now={t?.this_month ?? 0} prev={t?.last_month ?? 0} suffix="vs last month" />} spark={stats.months.map((m) => m.value)} />
        <Kpi icon={ReceiptText} label="Paid orders this month" value={String(t?.orders_month ?? 0)} sub={<span className="text-xs text-muted-foreground">average order {rm(t?.avg_order ?? 0)}</span>} tone="amber" />
        <Kpi icon={HandCoins} label="All time" value={rm(t?.all_time ?? 0)} sub={<span className="text-xs text-muted-foreground">{rm(t?.discounts ?? 0)} given in promo discounts</span>} tone="ok" />
        <Kpi icon={Undo2} label="Refunded" value={rm(t?.refunds ?? 0)} sub={<span className="text-xs text-muted-foreground">{t?.refund_count ?? 0} payments</span>} tone="ink" />
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card className="rounded-3xl p-6">
          <h2 className="text-lg font-bold">Revenue by month</h2>
          <p className="mb-4 mt-1 text-sm text-muted-foreground">After refunds, last 12 months.</p>
          <Bars data={stats.months} format={rm} />
        </Card>
        <Card className="rounded-3xl p-6">
          <h2 className="text-lg font-bold">Where it comes from</h2>
          <p className="mb-4 mt-1 text-sm text-muted-foreground">All time, after refunds.</p>
          {stats.kinds.length ? (
            <ul className="grid gap-4">
              {stats.kinds.map((k) => (
                <li key={k.kind}>
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="font-semibold">{KIND_LABEL[k.kind] ?? k.kind}s</span>
                    <span>
                      <strong>{rm(k.value)}</strong>{" "}
                      <span className="text-muted-foreground">
                        · {k.n} {k.n === 1 ? "order" : "orders"}
                      </span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-brand" style={{ width: `${kindTotal ? Math.max(2, (k.value / kindTotal) * 100) : 0}%` }} />
                  </div>
                </li>
              ))}
              <li className="grid grid-cols-2 gap-3 pt-1 text-sm">
                <span className="rounded-2xl bg-canvas p-3">
                  <span className="block text-xs font-semibold text-muted-foreground">Free activations</span>
                  <span className="text-lg font-extrabold">{t?.free ?? 0}</span>
                </span>
                <span className="rounded-2xl bg-canvas p-3">
                  <span className="block text-xs font-semibold text-muted-foreground">Unfinished checkouts · 30 days</span>
                  <span className="text-lg font-extrabold">{t?.abandoned ?? 0}</span>
                </span>
              </li>
            </ul>
          ) : (
            <p className="rounded-2xl bg-canvas px-4 py-8 text-center text-sm text-muted-foreground">No payments yet.</p>
          )}
        </Card>
      </div>

      <div className="grid gap-3">
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          {(Object.keys(PAYMENT_FILTERS) as PaymentFilter[]).map((k) => (
            <Link
              key={k}
              href={`/admin/payments?${query(k)}`}
              className={cn("inline-flex h-9 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold", status === k ? "bg-brand text-white shadow-cherry" : "border border-border bg-card hover:bg-muted")}
            >
              {PAYMENT_FILTERS[k].label}
              <span className={cn("rounded-full px-1.5 text-xs", status === k ? "bg-white/25" : "bg-muted")}>{counts?.[k] ?? 0}</span>
            </Link>
          ))}
        </div>
        <form className="flex flex-wrap gap-2">
          <input type="hidden" name="status" value={status} />
          <div className="relative min-w-0 basis-full sm:max-w-sm sm:flex-1 sm:basis-auto">
            <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input name="q" defaultValue={term} placeholder="Receipt no, email, event or CHIP id" aria-label="Search payments" className="h-11 w-full rounded-full border border-input bg-card pl-10 pr-4 text-sm outline-none focus:border-brand" />
          </div>
          <select name="month" defaultValue={month ?? ""} aria-label="Month" className="h-11 rounded-full border border-input bg-card px-4 text-sm outline-none focus:border-brand">
            <option value="">All time</option>
            {stats.monthsList.map((m) => (
              <option key={m} value={m}>
                {monthName(m)}
              </option>
            ))}
          </select>
          <button className={btn("primary")}>Show</button>
        </form>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-3xl border border-border bg-card py-14 text-center text-sm text-muted-foreground">No payments match.</div>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-soft">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-canvas/60 px-5 py-3 text-sm">
            <span className="text-muted-foreground">
              {rows.length === 300 ? "Latest 300" : rows.length} {rows.length === 1 ? "payment" : "payments"}
              {month ? ` in ${monthName(month)}` : ""}
            </span>
            <span className="font-semibold">{rm(shown)} received (after refunds)</span>
          </div>
          <div className="hidden grid-cols-[minmax(0,1.1fr)_minmax(0,1.8fr)_minmax(0,1.8fr)_minmax(0,0.9fr)_minmax(0,0.9fr)] gap-3 border-b border-border px-5 py-2.5 text-xs font-bold text-muted-foreground lg:grid">
            <span>Date</span>
            <span>Organiser</span>
            <span>What</span>
            <span className="text-right">Amount</span>
            <span className="text-right">Status</span>
          </div>
          <ul className="divide-y divide-border">
            {rows.map((p) => (
              <li key={p.id}>
                <Link href={`/admin/payments/${p.id}`} className="flex items-start gap-3 px-4 py-3 hover:bg-canvas/60 lg:hidden">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{p.name ?? p.email}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {p.description} · {p.event}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {formatDateTime(p.paid_at ?? p.created_at)}
                      {p.receipt_no ? ` · ${p.receipt_no}` : ""}
                    </span>
                  </span>
                  <span className="grid shrink-0 justify-items-end gap-1">
                    <span className="font-semibold">{formatMoney(p.amount_cents)}</span>
                    <PaymentStatus p={p} />
                  </span>
                </Link>
                <Link
                  href={`/admin/payments/${p.id}`}
                  className="hidden gap-3 px-5 py-3.5 hover:bg-canvas/60 lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.8fr)_minmax(0,1.8fr)_minmax(0,0.9fr)_minmax(0,0.9fr)] lg:items-center"
                >
                  <span className="text-sm">
                    {formatDateTime(p.paid_at ?? p.created_at)}
                    <span className="block font-mono text-[11px] text-muted-foreground">{p.receipt_no ?? "no receipt"}</span>
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{p.name ?? p.email}</span>
                    <span className="block truncate text-xs text-muted-foreground">{p.name ? p.email : p.event}</span>
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm">{p.description}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {p.event}
                      {p.promo ? ` · code ${p.promo}` : ""}
                    </span>
                  </span>
                  <span className="text-right text-sm font-semibold">
                    {formatMoney(p.amount_cents)}
                    {p.discount_cents ? <span className="block text-[11px] font-normal text-muted-foreground">−{formatMoney(p.discount_cents)} promo</span> : null}
                  </span>
                  <span className="flex justify-end">
                    <PaymentStatus p={p} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
