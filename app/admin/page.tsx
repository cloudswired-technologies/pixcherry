import Link from "next/link";
import { PhaseBadge } from "@/components/event-bits";
import { Card, Notice, PageHeader, Stat } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { one, q } from "@/lib/db";
import { formatBytes, formatDate, formatDateTime, formatMoney, hoursSince } from "@/lib/format";
import { eventPhase } from "@/lib/limits";
import { storageCostMyr } from "@/lib/costs";

export const dynamic = "force-dynamic";

export default async function AdminOverview() {
  await requireAdmin();
  const [ev, photos, rev, queue, cron, upcomingDeletes, recent] = await Promise.all([
    one<{ total: number; paid: number; active: number; ended: number; purged: number; drafts: number; bytes: string; guests: number }>(
      `select count(*)::int as total,
         count(*) filter (where paid_at is not null)::int as paid,
         count(*) filter (where paid_at is not null and purged_at is null and now() <= ends_at + interval '2 days')::int as active,
         count(*) filter (where paid_at is not null and purged_at is null and now() > ends_at + interval '2 days')::int as ended,
         count(*) filter (where purged_at is not null)::int as purged,
         count(*) filter (where paid_at is null)::int as drafts,
         coalesce(sum(bytes_used), 0)::text as bytes,
         coalesce(sum(guest_count), 0)::int as guests
       from events`,
    ),
    one<{ live: number; all_time: number }>(
      "select count(*) filter (where status in ('ready','review'))::int as live, count(*) filter (where ready_at is not null)::int as all_time from photos",
    ),
    one<{ total: number; month: number; count: number }>(
      `select coalesce(sum(amount_cents), 0)::int as total,
         coalesce(sum(amount_cents) filter (where paid_at >= date_trunc('month', now() at time zone 'Asia/Kuala_Lumpur') at time zone 'Asia/Kuala_Lumpur'), 0)::int as month,
         count(*)::int as count
       from purchases where status = 'paid'`,
    ),
    one<{ waiting: number; processing: number; failed24: number; pending: number }>(
      `select count(*) filter (where status = 'uploaded')::int as waiting,
         count(*) filter (where status = 'processing')::int as processing,
         count(*) filter (where status in ('failed','rejected') and created_at > now() - interval '24 hours')::int as failed24,
         count(*) filter (where status = 'pending')::int as pending
       from photos where status in ('uploaded','processing','failed','rejected','pending')`,
    ),
    one<{ value: { at: string; stale: number; warned: number; purged: { events: number; objects: number }; drafts: number } }>("select value from settings where key = 'last_cron'"),
    q<{ id: string; name: string; deletion_at: Date; photo_count: number }>(
      "select id, name, deletion_at, photo_count from events where purged_at is null and paid_at is not null and deletion_at < now() + interval '7 days' order by deletion_at limit 10",
    ),
    q<{ id: string; name: string; starts_at: Date; ends_at: Date; paid_at: Date | null; purged_at: Date | null; photo_count: number; email: string }>(
      "select e.id, e.name, e.starts_at, e.ends_at, e.paid_at, e.purged_at, e.photo_count, u.email from events e join users u on u.id = e.owner_id order by e.created_at desc limit 10",
    ),
  ]);
  const bytes = Number(ev?.bytes ?? 0);
  const cronAge = cron ? hoursSince(cron.value.at) : null;

  return (
    <div className="grid gap-6">
      <PageHeader title="Overview" />
      {cronAge === null || cronAge > 2 ? (
        <Notice tone="warn">
          The hourly cleanup job {cronAge === null ? "has never run" : `last ran ${Math.round(cronAge)} hours ago`}. Photos won&apos;t be deleted on time until it runs.
        </Notice>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Revenue (all time)" value={formatMoney(rev?.total ?? 0)} hint={`${rev?.count ?? 0} payments · ${formatMoney(rev?.month ?? 0)} this month`} />
        <Stat label="Events" value={ev?.total ?? 0} hint={`${ev?.paid ?? 0} paid · ${ev?.drafts ?? 0} unpaid drafts`} />
        <Stat label="Active events" value={ev?.active ?? 0} hint={`${ev?.ended ?? 0} ended (in storage) · ${ev?.purged ?? 0} deleted`} />
        <Stat label="Photos stored" value={(photos?.live ?? 0).toLocaleString("en-MY")} hint={`${(photos?.all_time ?? 0).toLocaleString("en-MY")} processed all time · ${ev?.guests ?? 0} guests`} />
        <Stat label="Storage used" value={formatBytes(bytes)} hint={`≈ ${storageCostMyr(bytes)} / month on R2`} />
        <Stat label="Processing queue" value={(queue?.waiting ?? 0) + (queue?.processing ?? 0)} hint={`${queue?.processing ?? 0} in progress · ${queue?.pending ?? 0} uploading`} />
        <Stat label="Failed / rejected (24 h)" value={queue?.failed24 ?? 0} hint="Unreadable or broken files" />
        <Stat
          label="Last cleanup"
          value={cron ? formatDateTime(cron.value.at) : "Never"}
          hint={cron ? `${cron.value.purged?.events ?? 0} events deleted · ${cron.value.warned ?? 0} warned · ${cron.value.stale ?? 0} stale uploads` : undefined}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="grid content-start gap-3">
          <h2 className="font-bold">Recent events</h2>
          <ul className="divide-y divide-border text-sm">
            {recent.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-2">
                <Link href={`/admin/events/${e.id}`} className="min-w-0">
                  <span className="block truncate font-medium hover:underline">{e.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {e.email} · {formatDate(e.starts_at)}
                  </span>
                </Link>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="text-xs text-muted-foreground">{e.photo_count}</span>
                  <PhaseBadge phase={eventPhase(e)} />
                </span>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="grid content-start gap-3">
          <h2 className="font-bold">Deleting in the next 7 days</h2>
          {upcomingDeletes.length ? (
            <ul className="divide-y divide-border text-sm">
              {upcomingDeletes.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 py-2">
                  <Link href={`/admin/events/${e.id}`} className="truncate hover:underline">
                    {e.name}
                  </Link>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatDate(e.deletion_at)} · {e.photo_count} photos
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Nothing scheduled.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
