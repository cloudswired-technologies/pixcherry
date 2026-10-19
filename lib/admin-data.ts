import "server-only";
import { one, q } from "@/lib/db";

// Queries behind Admin → Organisers and Admin → Payments (and the payments CSV export).
// Money is "net": what was paid minus any refund recorded against it. Days are Malaysian days.

const TZ = "Asia/Kuala_Lumpur";
const like = (s: string) => `%${s.replace(/[%_\\]/g, "\\$&")}%`;
export const NET = "(p.amount_cents - coalesce(p.refund_cents, 0))";
const CLOSED = "u.email like '%@deleted.invalid'";

// ------------------------------------------------------------------ organisers

export const USER_FILTERS = {
  all: { label: "All", where: `not ${CLOSED}` },
  paying: { label: "Paying", where: `exists (select 1 from purchases p where p.user_id = u.id and p.status = 'paid' and p.amount_cents > 0)` },
  new: { label: "New · 30 days", where: `not ${CLOSED} and u.created_at > now() - interval '30 days'` },
  idle: { label: "No events yet", where: `not ${CLOSED} and not exists (select 1 from events e where e.owner_id = u.id)` },
  admins: { label: "Admins", where: "u.is_admin" },
  suspended: { label: "Suspended", where: "u.suspended_at is not null" },
  closed: { label: "Closed", where: CLOSED },
} as const;
export type UserFilter = keyof typeof USER_FILTERS;

export type UserRow = {
  id: string; email: string; name: string | null; phone: string | null; is_admin: boolean; suspended_at: Date | null;
  created_at: Date; last_login_at: Date | null; events: number; paid_events: number; spent: number; is_new: boolean;
};

const USER_COLS = `u.id, u.email, u.name, u.phone, u.is_admin, u.suspended_at, u.created_at, u.last_login_at,
  u.created_at > now() - interval '30 days' is_new,
  (select count(*)::int from events e where e.owner_id = u.id and not e.is_demo) events,
  (select count(*)::int from events e where e.owner_id = u.id and e.paid_at is not null and not e.is_demo) paid_events,
  (select coalesce(sum(${NET}), 0)::int from purchases p where p.user_id = u.id and p.status = 'paid') spent`;

export async function listUsers(filter: UserFilter, term: string) {
  const params: unknown[] = [];
  let where = USER_FILTERS[filter].where;
  if (term) where += ` and (u.email ilike $${params.push(like(term))} or u.name ilike $1 or u.phone ilike $1)`;
  const [rows, counts, totals] = await Promise.all([
    q<UserRow>(`select ${USER_COLS} from users u where ${where} order by u.created_at desc limit 300`, params),
    one<Record<UserFilter, number>>(
      `select ${(Object.keys(USER_FILTERS) as UserFilter[]).map((k) => `count(*) filter (where ${USER_FILTERS[k].where})::int as ${k}`).join(", ")} from users u`,
    ),
    one<{ n30: number; nprev: number; active30: number; spend: number; payers: number }>(
      `select count(*) filter (where created_at > now() - interval '30 days')::int n30,
         count(*) filter (where created_at <= now() - interval '30 days' and created_at > now() - interval '60 days')::int nprev,
         count(*) filter (where last_login_at > now() - interval '30 days')::int active30,
         (select coalesce(sum(${NET}), 0)::int from purchases p where p.status = 'paid') spend,
         (select count(distinct p.user_id)::int from purchases p where p.status = 'paid' and p.amount_cents > 0) payers
       from users u where not ${CLOSED}`,
    ),
  ]);
  return { rows, counts, totals };
}

export async function getUser(id: string) {
  const user = await one<UserRow & { suspended_reason: string | null; admin_note: string | null }>(
    `select ${USER_COLS}, u.suspended_reason, u.admin_note from users u where u.id = $1`,
    [id],
  );
  if (!user) return null;
  const [events, payments, totals, logins, emails, activity] = await Promise.all([
    q<{ id: string; name: string; slug: string; starts_at: Date; ends_at: Date; paid_at: Date | null; purged_at: Date | null; cover_key: string | null; updated_at: Date; photo_count: number; guest_count: number; plan: string | null; is_demo: boolean }>(
      `select id, name, slug, starts_at, ends_at, paid_at, purged_at, cover_key, updated_at, photo_count, guest_count, plan_snapshot->>'name' plan, is_demo
       from events where owner_id = $1 order by created_at desc limit 50`,
      [id],
    ),
    q<PaymentRow>(`${PAYMENT_SELECT} where p.user_id = $1 order by coalesce(p.paid_at, p.created_at) desc limit 50`, [id]),
    one<{ photos: number; guests: number; bytes: string }>(
      `select coalesce(sum(photo_count), 0)::int photos, coalesce(sum(guest_count), 0)::int guests, coalesce(sum(bytes_used) filter (where purged_at is null), 0)::text bytes
       from events where owner_id = $1 and not is_demo`,
      [id],
    ),
    q<{ created_at: Date; used_at: Date | null; attempts: number; expired: boolean }>(
      "select created_at, used_at, attempts, expires_at < now() expired from login_codes where email = $1 order by created_at desc limit 8",
      [user.email],
    ),
    q<{ id: number; template: string; ok: boolean; error: string | null; created_at: Date }>(
      "select id, template, ok, error, created_at from email_log where to_email = $1 order by id desc limit 10",
      [user.email],
    ),
    q<ActivityRow>(
      `select a.id, a.action, a.target, a.details, a.created_at, u.email actor from audit_log a left join users u on u.id = a.actor_id
       where a.actor_id = $1 or a.target = $1::text
          or a.target in (select e.id::text from events e where e.owner_id = $1)
          or a.target in (select p.id::text from purchases p where p.user_id = $1)
       order by a.id desc limit 25`,
      [id],
    ),
  ]);
  return { user, events, payments, totals, logins, emails, activity };
}

export type ActivityRow = { id: number; action: string; target: string | null; details: Record<string, unknown>; created_at: Date; actor: string | null };

// ------------------------------------------------------------------ payments

export const PAYMENT_FILTERS = {
  all: { label: "All", where: "true" },
  paid: { label: "Paid", where: "p.status = 'paid' and p.refunded_at is null" },
  refunded: { label: "Refunded", where: "p.refunded_at is not null" },
  pending: { label: "Waiting for payment", where: "p.status = 'pending'" },
  failed: { label: "Failed / cancelled", where: "p.status in ('failed','cancelled')" },
} as const;
export type PaymentFilter = keyof typeof PAYMENT_FILTERS;

export type PaymentRow = {
  id: string; kind: "plan" | "upgrade" | "addon"; description: string; status: string; subtotal_cents: number; discount_cents: number; amount_cents: number;
  refund_cents: number | null; refunded_at: Date | null; refund_note: string | null; receipt_no: string | null; chip_purchase_id: string | null;
  paid_at: Date | null; created_at: Date; event_id: string; event: string; user_id: string; email: string; name: string | null; promo: string | null;
};

const PAYMENT_SELECT = `select p.id, p.kind, p.description, p.status, p.subtotal_cents, p.discount_cents, p.amount_cents, p.refund_cents, p.refunded_at,
    p.refund_note, p.receipt_no, p.chip_purchase_id, p.paid_at, p.created_at, p.event_id, e.name event, p.user_id, u.email, u.name, pc.code promo
  from purchases p join events e on e.id = p.event_id join users u on u.id = p.user_id left join promo_codes pc on pc.id = p.promo_code_id`;

/** "2026-10" -> that Malaysian month; anything else -> all time. */
export function monthRange(month: string | undefined) {
  return month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : null;
}

export async function listPayments(opts: { filter: PaymentFilter; term: string; month: string | null }, limit = 300) {
  const params: unknown[] = [];
  let where = PAYMENT_FILTERS[opts.filter].where;
  if (opts.term) {
    const i = params.push(like(opts.term));
    where += ` and (u.email ilike $${i} or u.name ilike $${i} or e.name ilike $${i} or p.receipt_no ilike $${i} or p.chip_purchase_id ilike $${i} or p.id::text = $${params.push(opts.term.toLowerCase())})`;
  }
  if (opts.month) where += ` and to_char(coalesce(p.paid_at, p.created_at) at time zone '${TZ}', 'YYYY-MM') = $${params.push(opts.month)}`;
  return q<PaymentRow>(`${PAYMENT_SELECT} where ${where} order by coalesce(p.paid_at, p.created_at) desc limit ${Math.min(limit, 5000)}`, params);
}

export async function paymentCounts() {
  return one<Record<PaymentFilter, number>>(
    `select ${(Object.keys(PAYMENT_FILTERS) as PaymentFilter[]).map((k) => `count(*) filter (where ${PAYMENT_FILTERS[k].where})::int as ${k}`).join(", ")} from purchases p`,
  );
}

export async function paymentStats() {
  const month = `date_trunc('month', now() at time zone '${TZ}')`;
  const [totals, months, kinds, monthsList] = await Promise.all([
    one<{ this_month: number; last_month: number; all_time: number; refunds: number; refund_count: number; orders_month: number; avg_order: number; discounts: number; free: number; abandoned: number }>(
      `select coalesce(sum(${NET}) filter (where p.status = 'paid' and (p.paid_at at time zone '${TZ}') >= ${month}), 0)::int this_month,
         coalesce(sum(${NET}) filter (where p.status = 'paid' and (p.paid_at at time zone '${TZ}') >= ${month} - interval '1 month' and (p.paid_at at time zone '${TZ}') < ${month}), 0)::int last_month,
         coalesce(sum(${NET}) filter (where p.status = 'paid'), 0)::int all_time,
         coalesce(sum(p.refund_cents), 0)::int refunds,
         count(*) filter (where p.refunded_at is not null)::int refund_count,
         count(*) filter (where p.status = 'paid' and p.amount_cents > 0 and (p.paid_at at time zone '${TZ}') >= ${month})::int orders_month,
         coalesce(avg(p.amount_cents) filter (where p.status = 'paid' and p.amount_cents > 0), 0)::int avg_order,
         coalesce(sum(p.discount_cents) filter (where p.status = 'paid'), 0)::int discounts,
         count(*) filter (where p.status = 'paid' and p.amount_cents = 0)::int free,
         count(*) filter (where p.status = 'pending' and p.created_at > now() - interval '30 days')::int abandoned
       from purchases p`,
    ),
    q<{ label: string; value: number }>(
      `select to_char(m, 'Mon YY') label, coalesce(sum(${NET}), 0)::int value
       from generate_series(${month} - interval '11 months', ${month}, interval '1 month') m
       left join purchases p on p.status = 'paid' and date_trunc('month', p.paid_at at time zone '${TZ}') = m
       group by m order by m`,
    ),
    q<{ kind: string; value: number; n: number }>(
      `select p.kind, coalesce(sum(${NET}), 0)::int value, count(*)::int n from purchases p where p.status = 'paid' and p.amount_cents > 0 group by p.kind order by 2 desc`,
    ),
    q<{ month: string }>(
      `select distinct to_char(coalesce(paid_at, created_at) at time zone '${TZ}', 'YYYY-MM') as month from purchases order by 1 desc limit 24`,
    ),
  ]);
  return { totals, months, kinds, monthsList: monthsList.map((m) => m.month) };
}

export async function getPayment(id: string) {
  const p = await one<PaymentRow & { plan: string | null; addon: string | null }>(
    `select x.*, pl.name plan, ad.name addon from (${PAYMENT_SELECT} where p.id = $1) x
     left join purchases pp on pp.id = x.id left join plans pl on pl.id = pp.plan_id left join plan_addons ad on ad.id = pp.addon_id`,
    [id],
  );
  if (!p) return null;
  const [callbacks, activity] = await Promise.all([
    q<{ id: number; ok: boolean; note: string | null; created_at: Date }>("select id, ok, note, created_at from webhook_log where ref = $1 order by id desc limit 20", [id]),
    q<ActivityRow>(
      `select a.id, a.action, a.target, a.details, a.created_at, u.email actor from audit_log a left join users u on u.id = a.actor_id
       where a.target = $1 or a.details->>'purchase' = $1 order by a.id desc limit 20`,
      [id],
    ),
  ]);
  return { p, callbacks, activity };
}

export const KIND_LABEL: Record<string, string> = { plan: "Package", upgrade: "Upgrade", addon: "Add-on" };

/** Plain words for audit actions shown to admins. */
export const ACTION_LABEL: Record<string, string> = {
  "account.closed": "Account closed",
  "user.update": "Profile edited by admin",
  "user.suspend": "Suspended",
  "user.unsuspend": "Suspension lifted",
  "user.signout": "Signed out everywhere",
  "user.admin_on": "Made an admin",
  "user.admin_off": "Admin access removed",
  "user.close": "Account closed by admin",
  "payment.refund": "Refund recorded",
  "payment.refund_removed": "Refund record removed",
  "payment.recheck": "Checked with CHIP",
  "event.activate": "Activated by admin",
  "event.overrides": "Limits adjusted by admin",
  "event.purged": "Photos deleted",
  "purchase.plan.paid": "Package paid",
  "purchase.upgrade.paid": "Upgrade paid",
  "purchase.addon.paid": "Add-on paid",
  "purchase.duplicate": "Paid twice for a package",
  "promo.over_limit": "Promo used past its limit",
};
