import Link from "next/link";
import { Search } from "lucide-react";
import { PhaseBadge } from "@/components/event-bits";
import { cn } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { one, q } from "@/lib/db";
import { coverUrl } from "@/lib/events";
import { formatBytes, formatDate, formatMoney } from "@/lib/format";
import { eventPhase } from "@/lib/limits";

export const metadata = { title: "Events" };

const FILTERS = {
  // Deleted albums only clutter the list; they have their own filter.
  all: { label: "All", where: "e.purged_at is null" },
  live: { label: "Live now", where: "e.paid_at is not null and e.purged_at is null and now() between e.starts_at and e.ends_at" },
  upcoming: { label: "Upcoming", where: "e.paid_at is not null and e.purged_at is null and e.starts_at > now()" },
  ended: { label: "Ended", where: "e.paid_at is not null and e.purged_at is null and e.ends_at < now()" },
  drafts: { label: "Not paid", where: "e.paid_at is null" },
  deleted: { label: "Deleted", where: "e.purged_at is not null" },
} as const;
type Filter = keyof typeof FILTERS;

export default async function AdminEvents({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const term = (sp.q ?? "").trim().slice(0, 100);
  const status: Filter = sp.status && sp.status in FILTERS ? (sp.status as Filter) : "all";
  const params: unknown[] = [];
  let where = FILTERS[status].where;
  if (term) where += ` and (e.name ilike $${params.push(`%${term.replace(/[%_\\]/g, "\\$&")}%`)} or u.email ilike $1 or e.slug = lower($${params.push(term)}))`;
  const [rows, counts] = await Promise.all([
    q<{
      id: string; name: string; slug: string; starts_at: Date; ends_at: Date; paid_at: Date | null; purged_at: Date | null; cover_key: string | null; updated_at: Date;
      photo_count: number; guest_count: number; bytes_used: string; email: string; plan: string | null; paid_cents: number;
    }>(
      `select e.id, e.name, e.slug, e.starts_at, e.ends_at, e.paid_at, e.purged_at, e.cover_key, e.updated_at, e.photo_count, e.guest_count, e.bytes_used,
         u.email, e.plan_snapshot->>'name' as plan,
         (select coalesce(sum(p.amount_cents), 0)::int from purchases p where p.event_id = e.id and p.status = 'paid') as paid_cents
       from events e join users u on u.id = e.owner_id
       where ${where} order by e.created_at desc limit 300`,
      params,
    ),
    one<Record<Filter, number>>(
      `select ${(Object.keys(FILTERS) as Filter[]).map((k) => `count(*) filter (where ${FILTERS[k].where})::int as ${k}`).join(", ")} from events e`,
    ),
  ]);
  const link = (s: Filter) => `/admin/events?status=${s}${term ? `&q=${encodeURIComponent(term)}` : ""}`;

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Events</h1>
          <p className="mt-1 text-sm text-muted-foreground">Every album on PixCherry, newest first. Deleted ones are under “Deleted”.</p>
        </div>
        <form className="relative w-full sm:w-80">
          <input type="hidden" name="status" value={status} />
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input name="q" defaultValue={term} placeholder="Search name, organiser email or link" aria-label="Search events" className="h-11 w-full rounded-full border border-input bg-card pl-10 pr-4 text-sm outline-none focus:border-brand" />
        </form>
      </div>

      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {(Object.keys(FILTERS) as Filter[]).map((k) => (
          <Link
            key={k}
            href={link(k)}
            className={cn("inline-flex h-9 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold", status === k ? "bg-brand text-white shadow-cherry" : "border border-border bg-card hover:bg-muted")}
          >
            {FILTERS[k].label}
            <span className={cn("rounded-full px-1.5 text-xs", status === k ? "bg-white/25" : "bg-muted")}>{counts?.[k] ?? 0}</span>
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-3xl border border-border bg-card py-14 text-center text-sm text-muted-foreground">No events match.</div>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-soft">
          <div className="hidden grid-cols-[minmax(0,2.4fr)_minmax(0,1.4fr)_minmax(0,1fr)_repeat(3,minmax(0,0.7fr))_minmax(0,0.9fr)] gap-3 border-b border-border bg-canvas/60 px-5 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground lg:grid">
            <span>Event</span>
            <span>Organiser</span>
            <span>Package</span>
            <span className="text-right">Photos</span>
            <span className="text-right">Guests</span>
            <span className="text-right">Paid</span>
            <span className="text-right">Status</span>
          </div>
          <ul className="divide-y divide-border">
            {rows.map((e) => {
              const cover = coverUrl(e);
              return (
                <li key={e.id}>
                  <Link
                    href={`/admin/events/${e.id}`}
                    className="grid gap-2 px-5 py-3.5 hover:bg-canvas/60 lg:grid-cols-[minmax(0,2.4fr)_minmax(0,1.4fr)_minmax(0,1fr)_repeat(3,minmax(0,0.7fr))_minmax(0,0.9fr)] lg:items-center lg:gap-3"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      {cover ? <img src={cover} alt="" className="size-11 shrink-0 rounded-xl object-cover" /> : <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-soft">📸</span>}
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{e.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {formatDate(e.starts_at)} · /{e.slug}
                        </span>
                      </span>
                    </span>
                    <span className="truncate text-sm text-muted-foreground">{e.email}</span>
                    <span className="truncate text-sm">{e.plan ?? "—"}</span>
                    <span className="text-sm lg:text-right">
                      <span className="text-muted-foreground lg:hidden">Photos </span>
                      {e.photo_count.toLocaleString("en-MY")}
                      <span className="block text-[11px] text-muted-foreground">{formatBytes(Number(e.bytes_used))}</span>
                    </span>
                    <span className="text-sm lg:text-right">
                      <span className="text-muted-foreground lg:hidden">Guests </span>
                      {e.guest_count}
                    </span>
                    <span className="text-sm font-semibold lg:text-right">{e.paid_cents ? formatMoney(e.paid_cents) : "—"}</span>
                    <span className="lg:text-right">
                      <PhaseBadge phase={eventPhase(e)} />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
