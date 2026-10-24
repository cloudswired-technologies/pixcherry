import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Ban, Camera, CircleDollarSign, HardDrive, LogOut, Mail, PartyPopper, ShieldCheck, ShieldOff, Users } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { Kpi } from "@/components/charts";
import { Confirm } from "@/components/confirm";
import { ConfirmForm } from "@/components/confirm-form";
import { PhaseBadge } from "@/components/event-bits";
import { Badge, Card, Field, Input, Notice, Textarea, btn, cn } from "@/components/ui";
import { ACTION_LABEL, getUser } from "@/lib/admin-data";
import { requireAdmin } from "@/lib/auth";
import { coverUrl } from "@/lib/events";
import { formatBytes, formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { eventPhase } from "@/lib/limits";
import { PaymentStatus } from "../../payments/bits";
import { closeUser, saveUser, setAdmin, signOutUser, suspendUser, unsuspendUser } from "../actions";
import { Initial, UserBadges } from "../bits";

export const metadata = { title: "Organiser" };

const TEMPLATE: Record<string, string> = { login_code: "Login code", paid: "Payment receipt", deletion_warning: "Photos deleting soon", deleted: "Photos deleted" };

export default async function AdminUser({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const data = await getUser(id);
  if (!data) notFound();
  const { user: u, events, payments, totals, logins, emails, activity } = data;
  const closed = u.email.endsWith("@deleted.invalid");
  const self = u.id === admin.id;
  const refunds = payments.reduce((s, p) => s + (p.refund_cents ?? 0), 0);

  return (
    <div className="grid gap-6">
      <Link href="/admin/users" className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> All organisers
      </Link>

      <section className="flex flex-wrap items-center gap-4 rounded-3xl border border-border bg-card p-5 shadow-soft">
        <Initial name={u.name} email={u.email} className="size-16 rounded-3xl text-2xl" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-2xl font-extrabold tracking-tight">{u.name ?? u.email}</h1>
            <UserBadges u={u} />
          </div>
          <p className="mt-1 truncate text-sm text-muted-foreground">
            {u.name ? `${u.email} · ` : ""}
            {u.phone ? `${u.phone} · ` : ""}joined {formatDate(u.created_at)} · last sign-in {u.last_login_at ? formatDateTime(u.last_login_at) : "never"}
          </p>
        </div>
        {!closed ? (
          <div className="flex flex-wrap gap-2">
            <a href={`mailto:${u.email}`} className={btn("outline", "sm")}>
              <Mail aria-hidden /> Email
            </a>
            <Confirm
              action={signOutUser.bind(null, u.id)}
              title={self ? "Sign yourself out everywhere?" : "Sign them out everywhere?"}
              message={self ? "You'll need a new login code on every device, including this one." : "Every device they're signed in on is logged out. They can sign in again with a new code."}
              confirm="Sign out everywhere"
              danger={false}
              className={btn("outline", "sm")}
            >
              <LogOut aria-hidden /> Sign out everywhere
            </Confirm>
          </div>
        ) : null}
      </section>

      {u.suspended_at ? (
        <Notice tone="danger">
          Suspended on {formatDateTime(u.suspended_at)}: “{u.suspended_reason}”. They can&apos;t sign in. Their albums keep working for guests.
        </Notice>
      ) : null}
      {closed ? <Notice>This account was closed. Personal details were removed; payments and receipts are kept for the accounts.</Notice> : null}

      <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Kpi icon={PartyPopper} label="Events" value={`${u.paid_events} paid`} sub={<span className="text-xs text-muted-foreground">{u.events} created in all</span>} />
        <Kpi icon={CircleDollarSign} label="Spent" value={formatMoney(u.spent)} sub={<span className="text-xs text-muted-foreground">{refunds ? `after ${formatMoney(refunds)} refunded` : `${payments.filter((p) => p.status === "paid").length} payments`}</span>} tone="ok" />
        <Kpi icon={Camera} label="Photos" value={(totals?.photos ?? 0).toLocaleString("en-MY")} sub={<span className="text-xs text-muted-foreground">{(totals?.guests ?? 0).toLocaleString("en-MY")} guests joined</span>} tone="amber" />
        <Kpi icon={HardDrive} label="Storage now" value={formatBytes(Number(totals?.bytes ?? 0))} tone="ink" />
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="grid content-start gap-6">
          <Card className="rounded-3xl p-6">
            <h2 className="mb-3 text-lg font-bold">Events</h2>
            {events.length ? (
              <ul className="divide-y divide-border">
                {events.map((e) => {
                  const cover = coverUrl(e);
                  return (
                    <li key={e.id}>
                      <Link href={`/admin/events/${e.id}`} className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-canvas/60">
                        {cover ? <img src={cover} alt="" className="size-11 shrink-0 rounded-xl object-cover" /> : <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-soft">📸</span>}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{e.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {formatDate(e.starts_at)} · {e.plan ?? "no package"} · {e.photo_count} photos · {e.guest_count} guests
                          </span>
                        </span>
                        <PhaseBadge phase={eventPhase(e)} />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="rounded-2xl bg-canvas px-4 py-6 text-center text-sm text-muted-foreground">No events yet.</p>
            )}
          </Card>

          <Card className="rounded-3xl p-6">
            <h2 className="mb-3 text-lg font-bold">Payments</h2>
            {payments.length ? (
              <ul className="divide-y divide-border">
                {payments.map((p) => (
                  <li key={p.id}>
                    <Link href={`/admin/payments/${p.id}`} className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-canvas/60">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{p.description}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {p.event} · {formatDateTime(p.paid_at ?? p.created_at)}
                          {p.receipt_no ? ` · ${p.receipt_no}` : ""}
                        </span>
                      </span>
                      <PaymentStatus p={p} />
                      <span className="w-20 shrink-0 text-right font-semibold">{formatMoney(p.amount_cents)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-2xl bg-canvas px-4 py-6 text-center text-sm text-muted-foreground">No payments yet.</p>
            )}
          </Card>

          <Card className="rounded-3xl p-6">
            <h2 className="mb-3 text-lg font-bold">Activity</h2>
            {activity.length ? (
              <ol className="grid gap-3">
                {activity.map((a) => (
                  <li key={a.id} className="flex gap-3 text-sm">
                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand" aria-hidden />
                    <span className="min-w-0">
                      <span className="font-semibold">{ACTION_LABEL[a.action] ?? a.action}</span>
                      <span className="text-muted-foreground">
                        {" "}
                        · {formatDateTime(a.created_at)}
                        {a.actor && a.actor !== u.email ? ` · by ${a.actor}` : ""}
                        {typeof a.details?.reason === "string" ? ` · “${a.details.reason}”` : ""}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted-foreground">Nothing logged yet.</p>
            )}
          </Card>
        </div>

        <div className="grid content-start gap-6">
          {!closed ? (
            <Card className="rounded-3xl p-6">
              <h2 className="mb-3 text-lg font-bold">Profile</h2>
              <ActionForm action={saveUser.bind(null, u.id)} submit="Save profile">
                <Field label="Email" htmlFor="u-email" help="They sign in with this address. Changing it doesn't sign them out.">
                  <Input id="u-email" name="email" type="email" required defaultValue={u.email} />
                </Field>
                <Field label="Name" htmlFor="u-name">
                  <Input id="u-name" name="name" maxLength={80} defaultValue={u.name ?? ""} />
                </Field>
                <Field label="Phone" htmlFor="u-phone">
                  <Input id="u-phone" name="phone" maxLength={30} defaultValue={u.phone ?? ""} placeholder="+60 12-345 6789" />
                </Field>
                <Field label="Admin note" htmlFor="u-note" help="Only admins see this, e.g. “Wedding planner, sends us 3 events a month”.">
                  <Textarea id="u-note" name="admin_note" maxLength={2000} rows={3} defaultValue={u.admin_note ?? ""} />
                </Field>
              </ActionForm>
            </Card>
          ) : null}

          {!closed ? (
            <Card className="grid gap-4 rounded-3xl p-6">
              <h2 className="text-lg font-bold">Access</h2>
              <div className="flex items-start justify-between gap-3 rounded-2xl bg-canvas p-4">
                <div className="min-w-0">
                  <p className="font-semibold">Admin</p>
                  <p className="text-sm text-muted-foreground">{u.is_admin ? "Can open this admin area and change everything here." : "A normal organiser."}</p>
                </div>
                {u.is_admin ? (
                  self ? (
                    <Badge tone="brand">You</Badge>
                  ) : (
                    <Confirm
                      action={setAdmin.bind(null, u.id, false)}
                      title="Remove admin access?"
                      message="They keep their own events but can't open the admin area any more. Anyone listed in the server's ADMIN_EMAILS gets admin back at their next sign-in."
                      confirm="Remove admin"
                      className={btn("outline", "sm")}
                    >
                      <ShieldOff aria-hidden /> Remove
                    </Confirm>
                  )
                ) : !u.suspended_at ? (
                  <Confirm
                    action={setAdmin.bind(null, u.id, true)}
                    title={`Make ${u.name ?? u.email} an admin?`}
                    message="They'll see every event, organiser and payment, and can change packages, refunds and accounts."
                    confirm="Make admin"
                    className={btn("outline", "sm")}
                  >
                    <ShieldCheck aria-hidden /> Make admin
                  </Confirm>
                ) : null}
              </div>

              {u.suspended_at ? (
                <Confirm
                  action={unsuspendUser.bind(null, u.id)}
                  title="Lift the suspension?"
                  message="They can sign in again straight away."
                  confirm="Lift suspension"
                  danger={false}
                  className={cn(btn("primary"), "w-fit")}
                >
                  Lift suspension
                </Confirm>
              ) : !self && !u.is_admin ? (
                <div className="rounded-2xl border border-border p-4">
                  <p className="font-semibold">Suspend</p>
                  <p className="mb-3 text-sm text-muted-foreground">Signs them out and stops them signing in. Their albums keep working, so guests at a live event aren&apos;t affected.</p>
                  <ConfirmForm
                    action={suspendUser.bind(null, u.id)}
                    submit="Suspend account"
                    title={`Suspend ${u.name ?? u.email}?`}
                    message="They're signed out at once and can't sign in until you lift it."
                    confirm="Suspend"
                  >
                    <Field label="Reason (only admins see it)" htmlFor="u-reason">
                      <Input id="u-reason" name="reason" required minLength={3} maxLength={300} placeholder="e.g. Chargeback on CHIP, abusive photos" />
                    </Field>
                  </ConfirmForm>
                </div>
              ) : null}
            </Card>
          ) : null}

          <Card className="rounded-3xl p-6">
            <h2 className="mb-1 text-lg font-bold">Sign-in codes</h2>
            <p className="mb-3 text-sm text-muted-foreground">Helps when someone says “the code never came”.</p>
            {logins.length ? (
              <ul className="grid gap-2 text-sm">
                {logins.map((l, i) => (
                  <li key={i} className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">{formatDateTime(l.created_at)}</span>
                    {l.used_at ? (
                      <Badge tone="ok">Used</Badge>
                    ) : l.attempts >= 5 ? (
                      <Badge tone="danger">Too many tries</Badge>
                    ) : l.expired ? (
                      <Badge>Expired{l.attempts ? ` · ${l.attempts} wrong` : ""}</Badge>
                    ) : (
                      <Badge tone="warn">Waiting{l.attempts ? ` · ${l.attempts} wrong` : ""}</Badge>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No codes requested.</p>
            )}
          </Card>

          <Card className="rounded-3xl p-6">
            <h2 className="mb-3 text-lg font-bold">Emails we sent</h2>
            {emails.length ? (
              <ul className="grid gap-2 text-sm">
                {emails.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{TEMPLATE[m.template] ?? m.template}</span>
                      <span className="text-xs text-muted-foreground">{formatDateTime(m.created_at)}</span>
                    </span>
                    {m.ok ? <Badge tone="ok">Sent</Badge> : m.error === "not_configured" ? <Badge>Email sending off</Badge> : <Badge tone="danger">Failed</Badge>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">None yet.</p>
            )}
          </Card>

          {!closed && !self && !u.is_admin ? (
            <Card className="grid gap-3 rounded-3xl border-danger/30 p-6">
              <h2 className="flex items-center gap-2 text-lg font-bold text-danger">
                <Ban className="size-5" aria-hidden /> Close account
              </h2>
              <p className="text-sm text-muted-foreground">
                Deletes the photos, guests and wishes of {u.events === 1 ? "their 1 event" : `all ${u.events} of their events`}, removes their name, email and phone, and signs them out.
                Payments and receipts stay for the accounts. This can&apos;t be undone.
              </p>
              <ConfirmForm
                action={closeUser.bind(null, u.id)}
                submit="Close this account"
                title="Close this account for good?"
                message={
                  <>
                    Every photo in their {u.events === 1 ? "event" : `${u.events} events`} is deleted, including albums that are live right now. <Users className="inline size-4" aria-hidden /> Guests lose access too.
                  </>
                }
                confirm="Close account"
              >
                <Field label={`Type ${u.email} to confirm`} htmlFor="u-close">
                  <Input id="u-close" name="confirm_email" required autoComplete="off" placeholder={u.email} />
                </Field>
              </ConfirmForm>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
