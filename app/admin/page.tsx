import Link from "next/link";
import { Activity, ArrowRight, Camera, CircleDollarSign, HardDrive, PartyPopper, Radio, UserPlus, Users } from "lucide-react";
import { Bars, Delta, Donut, Kpi } from "@/components/charts";
import { AdminLoad } from "@/components/admin-load";
import { Card, Notice } from "@/components/ui";
import { adminOverview } from "@/lib/admin-stats";
import { busyWindows, upcomingLoad } from "@/lib/capacity";
import { requireAdmin } from "@/lib/auth";
import { storageCostMyr } from "@/lib/costs";
import { coverUrl } from "@/lib/events";
import { formatBytes, formatDate, formatDateTime, formatMoney, hoursSince } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Overview" };

const rm = (cents: number) => formatMoney(cents).replace(/\.00$/, "");

function greeting() {
  const h = Number(new Date().toLocaleString("en-GB", { hour: "numeric", hour12: false, timeZone: "Asia/Kuala_Lumpur" }));
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

function Head({ title, href, link }: { title: string; href?: string; link?: string }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-2">
      <h2 className="text-lg font-bold">{title}</h2>
      {href ? (
        <Link href={href} className="inline-flex items-center gap-1 text-sm font-semibold text-brand">
          {link ?? "See all"} <ArrowRight className="size-4" aria-hidden />
        </Link>
      ) : null}
    </div>
  );
}

export default async function AdminOverview() {
  const user = await requireAdmin();
  const [s, load] = await Promise.all([adminOverview(), upcomingLoad()]);
  const overloaded = busyWindows(load).filter((w) => w.load === "over");
  const bytes = Number(s.events?.bytes ?? 0);
  const cronAge = s.cron ? hoursSince(s.cron.value.at) : null;
  const queue = (s.queue?.waiting ?? 0) + (s.queue?.processing ?? 0);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-brand">{new Date().toLocaleDateString("en-MY", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kuala_Lumpur" })}</p>
          <h1 className="text-3xl font-extrabold tracking-tight">
            {greeting()}, {user.name?.split(" ")[0] ?? "there"} 👋
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Here&apos;s how PixCherry is doing.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/events" className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-semibold hover:bg-muted">
            All events
          </Link>
          <Link href="/admin/plans" className="inline-flex h-10 items-center gap-2 rounded-full bg-brand px-4 text-sm font-bold text-white shadow-cherry">
            Packages
          </Link>
        </div>
      </div>

      {cronAge === null || cronAge > 2 ? (
        <Notice tone="warn">
          The hourly cleanup job {cronAge === null ? "has never run" : `last ran ${Math.round(cronAge)} hours ago`}. Photos won&apos;t be deleted on time until it runs.
        </Notice>
      ) : null}

      {overloaded.length ? (
        <Notice tone="danger">
          Big events overlap {overloaded.length === 1 ? `on ${formatDate(overloaded[0].from)}` : `at ${overloaded.length} times ahead`} (up to {Math.max(...overloaded.map((w) => w.peak)).toLocaleString("en-MY")} guests at once). Uploads may queue — see Server load ahead below.
        </Notice>
      ) : null}

      <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Kpi
          icon={CircleDollarSign}
          label="Revenue · 30 days"
          value={rm(s.money?.rev30 ?? 0)}
          sub={<Delta now={s.money?.rev30 ?? 0} prev={s.money?.revprev ?? 0} />}
          spark={s.revDays.map((d) => d.value)}
        />
        <Kpi icon={PartyPopper} label="Paid events · 30 days" value={String(s.events?.paid30 ?? 0)} sub={<Delta now={s.events?.paid30 ?? 0} prev={s.events?.paidprev ?? 0} />} tone="amber" />
        <Kpi
          icon={Camera}
          label="Photos shared · 30 days"
          value={(s.photos?.n30 ?? 0).toLocaleString("en-MY")}
          sub={<Delta now={s.photos?.n30 ?? 0} prev={s.photos?.nprev ?? 0} />}
          spark={s.upDays.map((d) => d.value)}
          tone="ok"
        />
        <Kpi icon={Users} label="Guests joined · 30 days" value={(s.guests?.n30 ?? 0).toLocaleString("en-MY")} sub={<Delta now={s.guests?.n30 ?? 0} prev={s.guests?.nprev ?? 0} />} tone="ink" />
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { icon: Radio, label: "Live right now", value: s.events?.live ?? 0, tone: "text-ok" },
          { icon: PartyPopper, label: "Upcoming", value: s.events?.upcoming ?? 0, tone: "text-brand" },
          { icon: UserPlus, label: "Organisers", value: `${s.users?.total ?? 0} (+${s.users?.n30 ?? 0})`, tone: "text-[#b45309]", href: "/admin/users" },
          { icon: HardDrive, label: `Storage · ${storageCostMyr(bytes)}/mo`, value: formatBytes(bytes), tone: "text-ink" },
        ].map((x) => {
          const inner = (
            <>
              <x.icon className={`size-5 shrink-0 ${x.tone}`} aria-hidden />
              <div className="min-w-0">
                <div className="truncate text-xs font-semibold text-muted-foreground">{x.label}</div>
                <div className="text-lg font-extrabold">{x.value}</div>
              </div>
            </>
          );
          const cls = "flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3";
          return x.href ? (
            <Link key={x.label} href={x.href} className={`${cls} hover:bg-muted/60`}>
              {inner}
            </Link>
          ) : (
            <div key={x.label} className={cls}>
              {inner}
            </div>
          );
        })}
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="rounded-3xl p-6">
          <Head title="Revenue" />
          <p className="-mt-2 mb-4 text-sm text-muted-foreground">
            {rm(s.money?.rev30 ?? 0)} in the last 30 days · {rm(s.money?.revall ?? 0)} all time
          </p>
          <Bars data={s.revDays} format={(n) => rm(n)} />
        </Card>
        <Card className="rounded-3xl p-6">
          <Head title="Photos shared" />
          <p className="-mt-2 mb-4 text-sm text-muted-foreground">
            {(s.photos?.n30 ?? 0).toLocaleString("en-MY")} in the last 30 days · {(s.photos?.stored ?? 0).toLocaleString("en-MY")} stored now
          </p>
          <Bars data={s.upDays} />
        </Card>
      </div>

      <AdminLoad events={load} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card className="rounded-3xl p-6">
          <Head title="🔴 Live now" href="/admin/events?status=live" />
          {s.live.length ? (
            <ul className="grid gap-3 sm:grid-cols-2">
              {s.live.map((e) => {
                const cover = coverUrl(e);
                return (
                  <li key={e.id}>
                    <Link href={`/admin/events/${e.id}`} className="flex items-center gap-3 rounded-2xl border border-border p-3 hover:bg-muted/60">
                      {cover ? <img src={cover} alt="" className="size-12 rounded-xl object-cover" /> : <span className="grid size-12 place-items-center rounded-xl bg-brand-soft text-xl">📸</span>}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{e.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {e.photo_count} photos · {e.guest_count} guests · ends {formatDateTime(e.ends_at)}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="rounded-2xl bg-canvas px-4 py-8 text-center text-sm text-muted-foreground">No events are happening right now.</p>
          )}
        </Card>
        <Card className="rounded-3xl p-6">
          <Head title="Package mix" />
          <Donut parts={s.mix} center={`${s.events?.total_paid ?? 0} paid events`} />
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="rounded-3xl p-6">
          <Head title="Latest payments" href="/admin/payments" />
          {s.payments.length ? (
            <ul className="divide-y divide-border">
              {s.payments.map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-2.5">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-ok-soft text-ok">
                    <CircleDollarSign className="size-4" aria-hidden />
                  </span>
                  <Link href={`/admin/payments/${p.id}`} className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{p.event}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {p.email} · {formatDateTime(p.paid_at)}
                    </span>
                  </Link>
                  <span className="shrink-0 font-bold">{rm(p.amount_cents)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No payments yet.</p>
          )}
        </Card>
        <Card className="rounded-3xl p-6">
          <Head title="New organisers" href="/admin/users?status=new" />
          <ul className="divide-y divide-border">
            {s.signups.map((u) => (
              <li key={u.id}>
                <Link href={`/admin/users/${u.id}`} className="flex items-center gap-3 py-2.5 hover:bg-muted/40">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-soft text-sm font-bold uppercase text-brand">{(u.name ?? u.email).charAt(0)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{u.name ?? u.email}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {u.name ? `${u.email} · ` : ""}joined {formatDate(u.created_at)}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {u.paid}/{u.events} paid
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="rounded-3xl p-6">
          <Head title="Biggest albums" />
          <ol className="grid gap-2">
            {s.top.map((e, i) => (
              <li key={e.id}>
                <Link href={`/admin/events/${e.id}`} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-muted/60">
                  <span className="w-6 text-center text-sm font-bold text-muted-foreground">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate font-semibold">{e.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{e.plan}</span>
                  <span className="w-24 shrink-0 text-right text-sm font-semibold">{e.photo_count.toLocaleString("en-MY")} 📸</span>
                </Link>
              </li>
            ))}
          </ol>
        </Card>
        <Card className="rounded-3xl p-6">
          <Head title="System health" />
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Processing queue", value: queue, hint: `${s.queue?.pending ?? 0} uploading`, bad: queue > 50 },
              { label: "Failed · 24 h", value: s.queue?.failed24 ?? 0, hint: "unreadable files", bad: (s.queue?.failed24 ?? 0) > 10 },
              { label: "Last cleanup", value: s.cron ? formatDateTime(s.cron.value.at) : "Never", hint: `${s.cron?.value.purged?.events ?? 0} albums deleted`, bad: cronAge === null || cronAge > 2 },
              { label: "Unpaid drafts", value: s.events?.drafts ?? 0, hint: "auto-removed after 30 days", bad: false },
            ].map((x) => (
              <div key={x.label} className="rounded-2xl bg-canvas p-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                  <Activity className={`size-3.5 ${x.bad ? "text-danger" : "text-ok"}`} aria-hidden /> {x.label}
                </div>
                <div className="mt-1 truncate text-lg font-extrabold">{x.value}</div>
                <div className="text-xs text-muted-foreground">{x.hint}</div>
              </div>
            ))}
          </div>
          {s.deleting.length ? (
            <div className="mt-4">
              <div className="mb-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">Deleting in the next 7 days</div>
              <ul className="grid gap-1 text-sm">
                {s.deleting.map((e) => (
                  <li key={e.id} className="flex justify-between gap-2">
                    <Link href={`/admin/events/${e.id}`} className="truncate hover:underline">
                      {e.name}
                    </Link>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDate(e.deletion_at)} · {e.photo_count} photos
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
