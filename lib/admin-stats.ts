import "server-only";
import { one, q } from "@/lib/db";

// Numbers for the admin overview. Days are Malaysian days (MYT).

const TZ = "Asia/Kuala_Lumpur";

export async function adminOverview() {
  const [money, events, photos, guests, users, revDays, upDays, mix, live, payments, signups, top, queue, cron, deleting] = await Promise.all([
    one<{ rev30: number; revprev: number; revall: number; pay30: number }>(
      `select coalesce(sum(amount_cents) filter (where paid_at > now() - interval '30 days'), 0)::int rev30,
         coalesce(sum(amount_cents) filter (where paid_at <= now() - interval '30 days' and paid_at > now() - interval '60 days'), 0)::int revprev,
         coalesce(sum(amount_cents), 0)::int revall,
         count(*) filter (where paid_at > now() - interval '30 days')::int pay30
       from purchases where status = 'paid'`,
    ),
    one<{ paid30: number; paidprev: number; live: number; upcoming: number; ended: number; drafts: number; bytes: string; total_paid: number }>(
      `select count(*) filter (where paid_at > now() - interval '30 days')::int paid30,
         count(*) filter (where paid_at <= now() - interval '30 days' and paid_at > now() - interval '60 days')::int paidprev,
         count(*) filter (where paid_at is not null and purged_at is null and now() between starts_at and ends_at)::int live,
         count(*) filter (where paid_at is not null and purged_at is null and starts_at > now())::int upcoming,
         count(*) filter (where paid_at is not null and purged_at is null and ends_at < now())::int ended,
         count(*) filter (where paid_at is null)::int drafts,
         count(*) filter (where paid_at is not null)::int total_paid,
         coalesce(sum(bytes_used) filter (where purged_at is null), 0)::text bytes
       from events where not is_demo`,
    ),
    one<{ n30: number; nprev: number; stored: number }>(
      `select count(*) filter (where ready_at > now() - interval '30 days')::int n30,
         count(*) filter (where ready_at <= now() - interval '30 days' and ready_at > now() - interval '60 days')::int nprev,
         count(*) filter (where status in ('ready','review'))::int stored
       from photos`,
    ),
    one<{ n30: number; nprev: number }>(
      `select count(*) filter (where created_at > now() - interval '30 days')::int n30,
         count(*) filter (where created_at <= now() - interval '30 days' and created_at > now() - interval '60 days')::int nprev from guests`,
    ),
    one<{ total: number; n30: number }>("select count(*)::int total, count(*) filter (where created_at > now() - interval '30 days')::int n30 from users"),
    q<{ label: string; value: number }>(
      `select to_char(d, 'DD Mon') as label, coalesce(sum(p.amount_cents), 0)::int as value
       from generate_series((now() at time zone '${TZ}')::date - 29, (now() at time zone '${TZ}')::date, interval '1 day') d
       left join purchases p on p.status = 'paid' and (p.paid_at at time zone '${TZ}')::date = d::date
       group by d order by d`,
    ),
    q<{ label: string; value: number }>(
      `select to_char(d, 'DD Mon') as label, count(p.id)::int as value
       from generate_series((now() at time zone '${TZ}')::date - 29, (now() at time zone '${TZ}')::date, interval '1 day') d
       left join photos p on p.ready_at is not null and (p.ready_at at time zone '${TZ}')::date = d::date
       group by d order by d`,
    ),
    q<{ label: string; value: number }>(
      "select coalesce(plan_snapshot->>'name', '—') as label, count(*)::int as value from events where paid_at is not null and not is_demo group by 1 order by 2 desc limit 6",
    ),
    q<{ id: string; name: string; cover_key: string | null; updated_at: Date; photo_count: number; guest_count: number; email: string; ends_at: Date }>(
      `select e.id, e.name, e.cover_key, e.updated_at, e.photo_count, e.guest_count, e.ends_at, u.email from events e join users u on u.id = e.owner_id
       where e.paid_at is not null and e.purged_at is null and not e.is_demo and now() between e.starts_at and e.ends_at order by e.photo_count desc limit 6`,
    ),
    q<{ id: string; amount_cents: number; description: string; paid_at: Date; email: string; event: string; event_id: string }>(
      `select p.id, p.amount_cents, p.description, p.paid_at, u.email, e.name as event, e.id as event_id
       from purchases p join events e on e.id = p.event_id join users u on u.id = e.owner_id
       where p.status = 'paid' order by p.paid_at desc limit 8`,
    ),
    q<{ id: string; email: string; name: string | null; created_at: Date; events: number; paid: number }>(
      `select u.id, u.email, u.name, u.created_at,
         (select count(*)::int from events e where e.owner_id = u.id) events,
         (select count(*)::int from events e where e.owner_id = u.id and e.paid_at is not null) paid
       from users u order by u.created_at desc limit 8`,
    ),
    q<{ id: string; name: string; photo_count: number; guest_count: number; plan: string | null }>(
      `select id, name, photo_count, guest_count, plan_snapshot->>'name' plan from events
       where paid_at is not null and purged_at is null and not is_demo order by photo_count desc limit 5`,
    ),
    one<{ waiting: number; processing: number; failed24: number; pending: number }>(
      `select count(*) filter (where status = 'uploaded')::int waiting, count(*) filter (where status = 'processing')::int processing,
         count(*) filter (where status in ('failed','rejected') and created_at > now() - interval '24 hours')::int failed24,
         count(*) filter (where status = 'pending')::int pending
       from photos where status in ('uploaded','processing','failed','rejected','pending')`,
    ),
    one<{ value: { at: string; purged?: { events: number }; warned?: number } }>("select value from settings where key = 'last_cron'"),
    q<{ id: string; name: string; deletion_at: Date; photo_count: number }>(
      "select id, name, deletion_at, photo_count from events where purged_at is null and paid_at is not null and deletion_at < now() + interval '7 days' order by deletion_at limit 6",
    ),
  ]);
  return { money, events, photos, guests, users, revDays, upDays, mix, live, payments, signups, top, queue, cron, deleting };
}
