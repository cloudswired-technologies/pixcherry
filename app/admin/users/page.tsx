import Link from "next/link";
import { CircleDollarSign, Search, UserCheck, UserPlus, UsersRound } from "lucide-react";
import { Delta, Kpi } from "@/components/charts";
import { cn } from "@/components/ui";
import { USER_FILTERS, listUsers, type UserFilter } from "@/lib/admin-data";
import { requireAdmin } from "@/lib/auth";
import { formatDate, formatMoney } from "@/lib/format";
import { Initial, UserBadges, money } from "./bits";

export const metadata = { title: "Organisers" };

const ago = (d: Date | null) => {
  if (!d) return "Never";
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400_000);
  return days < 1 ? "Today" : days === 1 ? "Yesterday" : days < 30 ? `${days} days ago` : formatDate(d);
};

export default async function AdminUsers({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const term = (sp.q ?? "").trim().slice(0, 100);
  const status: UserFilter = sp.status && sp.status in USER_FILTERS ? (sp.status as UserFilter) : "all";
  const { rows, counts, totals } = await listUsers(status, term);
  const link = (s: UserFilter) => `/admin/users?status=${s}${term ? `&q=${encodeURIComponent(term)}` : ""}`;
  const payers = totals?.payers ?? 0;

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Organisers</h1>
          <p className="mt-1 text-sm text-muted-foreground">Everyone who has signed in to create an event. Open one to edit, suspend or close the account.</p>
        </div>
        <form className="relative w-full sm:w-80">
          <input type="hidden" name="status" value={status} />
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input name="q" defaultValue={term} placeholder="Search email, name or phone" aria-label="Search organisers" className="h-11 w-full rounded-full border border-input bg-card pl-10 pr-4 text-sm outline-none focus:border-brand" />
        </form>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={UsersRound} label="Organisers" value={(counts?.all ?? 0).toLocaleString("en-MY")} sub={<span className="text-xs text-muted-foreground">{totals?.active30 ?? 0} signed in this month</span>} />
        <Kpi icon={UserPlus} label="New · 30 days" value={String(totals?.n30 ?? 0)} sub={<Delta now={totals?.n30 ?? 0} prev={totals?.nprev ?? 0} />} tone="amber" />
        <Kpi
          icon={UserCheck}
          label="Paying customers"
          value={String(payers)}
          sub={<span className="text-xs text-muted-foreground">{counts?.all ? Math.round((payers / counts.all) * 100) : 0}% of organisers</span>}
          tone="ok"
        />
        <Kpi icon={CircleDollarSign} label="Spend per customer" value={payers ? formatMoney(Math.round((totals?.spend ?? 0) / payers)) : "—"} sub={<span className="text-xs text-muted-foreground">after refunds</span>} tone="ink" />
      </section>

      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {(Object.keys(USER_FILTERS) as UserFilter[]).map((k) => (
          <Link
            key={k}
            href={link(k)}
            className={cn("inline-flex h-9 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold", status === k ? "bg-brand text-white shadow-cherry" : "border border-border bg-card hover:bg-muted")}
          >
            {USER_FILTERS[k].label}
            <span className={cn("rounded-full px-1.5 text-xs", status === k ? "bg-white/25" : "bg-muted")}>{counts?.[k] ?? 0}</span>
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-3xl border border-border bg-card py-14 text-center text-sm text-muted-foreground">{term ? `No organisers match “${term}”.` : "No organisers here yet."}</div>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-soft">
          <div className="hidden grid-cols-[minmax(0,2.6fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,0.9fr)_minmax(0,1.2fr)] gap-3 border-b border-border bg-canvas/60 px-5 py-3 text-xs font-bold text-muted-foreground lg:grid">
            <span>Organiser</span>
            <span>Joined</span>
            <span>Last sign-in</span>
            <span className="text-right">Events</span>
            <span className="text-right">Spent</span>
            <span className="text-right">Status</span>
          </div>
          <ul className="divide-y divide-border">
            {rows.map((u) => (
              <li key={u.id}>
                <Link href={`/admin/users/${u.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-canvas/60 lg:hidden">
                  <Initial name={u.name} email={u.email} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{u.name ?? u.email}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {u.paid_events}/{u.events} paid · {money(u.spent)} · signed in {ago(u.last_login_at).toLowerCase()}
                    </span>
                    <span className="mt-1 block">
                      <UserBadges u={u} />
                    </span>
                  </span>
                </Link>
                <Link
                  href={`/admin/users/${u.id}`}
                  className="hidden gap-3 px-5 py-3.5 hover:bg-canvas/60 lg:grid lg:grid-cols-[minmax(0,2.6fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,0.9fr)_minmax(0,1.2fr)] lg:items-center"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <Initial name={u.name} email={u.email} />
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{u.name ?? u.email}</span>
                      <span className="block truncate text-xs text-muted-foreground">{u.name ? u.email : u.phone ?? "No name yet"}</span>
                    </span>
                  </span>
                  <span className="text-sm text-muted-foreground">{formatDate(u.created_at)}</span>
                  <span className="text-sm text-muted-foreground">{ago(u.last_login_at)}</span>
                  <span className="text-right text-sm">
                    {u.paid_events}
                    <span className="text-muted-foreground"> / {u.events} paid</span>
                  </span>
                  <span className="text-right text-sm font-semibold">{money(u.spent)}</span>
                  <span className="flex justify-end">
                    <UserBadges u={u} />
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
