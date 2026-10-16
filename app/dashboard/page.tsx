import Link from "next/link";
import { ArrowRight, CalendarDays, Camera, Heart, Images, Plus, QrCode, Sparkles, Users } from "lucide-react";
import { Kpi } from "@/components/charts";
import { PhaseBadge } from "@/components/event-bits";
import { Notice, btn } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { q } from "@/lib/db";
import { coverUrl, guestUrl, listOwnerEvents } from "@/lib/events";
import { formatDate, formatDateTime } from "@/lib/format";
import { eventPhase } from "@/lib/limits";

export const metadata = { title: "My events" };

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const { deleted } = await searchParams;
  const user = await requireUser();
  const all = await listOwnerEvents(user.id);
  // Deleted events leave the list; their receipts stay reachable below.
  const events = all.filter((e) => !e.purged_at);
  const gone = all.filter((e) => e.purged_at);
  const ids = events.map((e) => e.id);
  const hearts = ids.length ? await q<{ n: number }>("select coalesce(sum(vote_count), 0)::int n from photos where event_id = any($1::uuid[]) and status = 'ready'", [ids]) : [{ n: 0 }];
  const live = events.filter((e) => eventPhase(e) === "live");
  const photos = events.reduce((s, e) => s + e.photo_count, 0);
  const guests = events.reduce((s, e) => s + e.guest_count, 0);
  const first = (user.name ?? "").split(" ")[0];

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">{first ? `Hi ${first} 👋` : "My events"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{events.length ? "Your albums at a glance." : "Let's set up your first album."}</p>
        </div>
        <Link href="/dashboard/events/new" className={btn("brand", "md", "shadow-cherry")}>
          <Plus aria-hidden /> New event
        </Link>
      </div>
      {deleted ? <Notice tone="ok">The event was deleted.</Notice> : null}

      {events.length ? (
        <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <Kpi icon={CalendarDays} label="Events" value={String(events.length)} sub={<span className="text-xs text-muted-foreground">{live.length ? `${live.length} live now` : "none live right now"}</span>} />
          <Kpi icon={Camera} label="Photos" value={photos.toLocaleString("en-MY")} tone="ok" />
          <Kpi icon={Users} label="Guests" value={guests.toLocaleString("en-MY")} tone="amber" />
          <Kpi icon={Heart} label="Hearts" value={(hearts[0]?.n ?? 0).toLocaleString("en-MY")} tone="ink" />
        </section>
      ) : null}

      {live.map((e) => (
        <Link key={e.id} href={`/dashboard/events/${e.id}`} className="relative flex items-center gap-4 overflow-hidden rounded-3xl bg-gradient-to-r from-brand to-[#ff7a5c] p-5 text-white shadow-cherry">
          <span className="relative flex size-3 shrink-0">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-white opacity-70" />
            <span className="relative inline-flex size-3 rounded-full bg-white" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-bold uppercase tracking-wider text-white/80">Live now</span>
            <span className="block truncate text-xl font-extrabold">{e.name}</span>
            <span className="block text-sm text-white/85">
              {e.photo_count} photos · {e.guest_count} guests · until {formatDateTime(e.ends_at)}
            </span>
          </span>
          <ArrowRight className="size-6 shrink-0" aria-hidden />
        </Link>
      ))}

      {events.length === 0 ? (
        <section className="grid gap-6 rounded-3xl border border-border bg-card p-8 text-center shadow-soft sm:p-12">
          <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-brand-soft text-3xl">📸</span>
          <div>
            <h2 className="text-2xl font-extrabold">Every guest becomes your photographer</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">Create an event, put the QR code on the tables, and watch the album fill up live — no app for guests to install.</p>
          </div>
          <ol className="mx-auto grid max-w-2xl gap-3 text-left sm:grid-cols-3">
            {[
              { icon: Sparkles, t: "Create your event", d: "Name, date and a link that's easy to remember." },
              { icon: QrCode, t: "Share the QR code", d: "Print the card or show it on a screen." },
              { icon: Images, t: "Enjoy the album", d: "Photos, wishes and missions, live." },
            ].map((s, i) => (
              <li key={s.t} className="rounded-2xl bg-canvas p-4">
                <s.icon className="size-5 text-brand" aria-hidden />
                <div className="mt-2 text-sm font-bold">
                  {i + 1}. {s.t}
                </div>
                <div className="text-xs text-muted-foreground">{s.d}</div>
              </li>
            ))}
          </ol>
          <Link href="/dashboard/events/new" className={btn("brand", "lg", "mx-auto shadow-cherry")}>
            Create your event
          </Link>
        </section>
      ) : (
        <section>
          <h2 className="mb-3 text-lg font-bold">All events</h2>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {events.map((e) => {
              const cover = coverUrl(e);
              const phase = eventPhase(e);
              return (
                <div key={e.id} className="group flex flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-soft transition-shadow hover:shadow-lift">
                  <Link href={`/dashboard/events/${e.id}`} className="relative block aspect-[16/8] bg-gradient-to-br from-brand-soft via-[#ffe9d6] to-canvas">
                    {cover ? <img src={cover} alt="" className="size-full object-cover" /> : <span className="absolute inset-0 grid place-items-center text-5xl">📸</span>}
                    <span className="absolute left-3 top-3">
                      <PhaseBadge phase={phase} />
                    </span>
                  </Link>
                  <div className="flex flex-1 flex-col gap-3 p-5">
                    <Link href={`/dashboard/events/${e.id}`} className="min-w-0">
                      <h3 className="truncate text-lg font-extrabold group-hover:text-brand">{e.name}</h3>
                      <p className="text-sm text-muted-foreground">{formatDate(e.starts_at)}{e.venue ? ` · ${e.venue}` : ""}</p>
                    </Link>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <span className="flex items-center gap-2 rounded-xl bg-canvas px-3 py-2">
                        <Images className="size-4 text-brand" aria-hidden /> <strong>{e.photo_count.toLocaleString("en-MY")}</strong> photos
                      </span>
                      <span className="flex items-center gap-2 rounded-xl bg-canvas px-3 py-2">
                        <Users className="size-4 text-brand" aria-hidden /> <strong>{e.guest_count.toLocaleString("en-MY")}</strong> guests
                      </span>
                    </div>
                    <div className="mt-auto flex gap-2 pt-1">
                      <Link href={`/dashboard/events/${e.id}`} className={btn("primary", "sm", "flex-1")}>
                        Manage
                      </Link>
                      {e.paid_at ? (
                        <a href={guestUrl(e.slug)} target="_blank" rel="noreferrer" className={btn("outline", "sm", "flex-1")}>
                          Guest app
                        </a>
                      ) : (
                        <Link href={`/dashboard/events/${e.id}/checkout`} className={btn("brand", "sm", "flex-1")}>
                          Choose package
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {gone.length ? (
        <details className="rounded-3xl border border-border bg-card p-5 text-sm">
          <summary className="cursor-pointer font-semibold text-muted-foreground">Deleted events ({gone.length})</summary>
          <ul className="mt-3 divide-y divide-border">
            {gone.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0 truncate">
                  {e.name} <span className="text-muted-foreground">· {formatDate(e.starts_at)}</span>
                </span>
                <Link href={`/dashboard/events/${e.id}`} className="shrink-0 font-semibold text-brand">
                  Receipts
                </Link>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
