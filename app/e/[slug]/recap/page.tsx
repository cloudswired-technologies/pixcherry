import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Download } from "lucide-react";
import { Logo } from "@/components/brand";
import { one, q } from "@/lib/db";
import { eventStats, listMissions, listTagAlbums, listWishes } from "@/lib/engage";
import { redirect } from "next/navigation";
import { APP_URL } from "@/lib/env";
import { getEventBySlug, guestPath, guestUrl, logoUrl, renamedSlug } from "@/lib/events";
import { formatDate } from "@/lib/format";
import { photoKeys, publicUrl } from "@/lib/storage";
import { CountUp } from "./count-up";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const e = await getEventBySlug((await params).slug);
  return { title: e ? `${e.name} — the recap` : "Recap", robots: { index: false, follow: false } };
}

const MEDALS = ["🥇", "🥈", "🥉"];

// "Our day in numbers": a shareable look back at the event.
export default async function Recap({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const e = await getEventBySlug(slug);
  if (!e) {
    const moved = await renamedSlug(slug);
    if (moved) redirect(`${guestUrl(moved)}/recap`);
  }
  if (!e || !e.paid_at || e.purged_at) {
    return (
      <main className="grid min-h-dvh place-items-center px-6 text-center">
        <div className="grid justify-items-center gap-3">
          <Logo className="text-lg" />
          <h1 className="text-xl font-bold">{e?.purged_at ? "This album has closed" : "Event not found"}</h1>
        </div>
      </main>
    );
  }
  const f = e.cfg.features;
  const [stats, missions, wishes, hearts, best, albums] = await Promise.all([
    eventStats(e.id),
    f.missions ? listMissions(e.id) : Promise.resolve([]),
    f.wishes ? listWishes(e.id, { limit: 12 }) : Promise.resolve([]),
    one<{ n: number }>("select coalesce(sum(vote_count), 0)::int as n from photos where event_id = $1 and status = 'ready'", [e.id]),
    q<{ id: string; vote_count: number; name: string | null }>(
      `select p.id, p.vote_count, g.name from photos p left join guests g on g.id = p.guest_id
       where p.event_id = $1 and p.status = 'ready' order by p.vote_count desc, p.ready_at desc limit 9`,
      [e.id],
    ),
    f.tags ? listTagAlbums(e.id) : Promise.resolve([]),
  ]);
  const accent = (f.custom_branding && e.accent_color) || "#e91d48";
  const logo = f.custom_branding ? logoUrl(e) : null;
  const numbers = [
    { n: stats.photos, l: "photos" },
    { n: stats.guests, l: "photographers" },
    ...(f.wishes ? [{ n: stats.wishes, l: "wishes" }] : []),
    ...(f.voting ? [{ n: hearts?.n ?? 0, l: "hearts" }] : []),
  ];

  return (
    <div className="min-h-dvh bg-paper" style={{ "--brand": accent } as React.CSSProperties}>
      <header className="relative overflow-hidden bg-ink px-4 pb-14 pt-10 text-center text-white">
        <div className="pointer-events-none absolute -left-24 -top-24 size-72 rounded-full bg-brand/40 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-24 -right-16 size-72 rounded-full bg-brand/30 blur-3xl" aria-hidden />
        <div className="relative mx-auto max-w-2xl">
          {logo ? <img src={logo} alt="" className="mx-auto h-10 w-auto" /> : <Logo className="text-lg" light />}
          <p className="mt-8 text-xs font-bold uppercase tracking-[0.25em] text-white/70">✨ The recap</p>
          <h1 className="mt-2 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">{e.name}</h1>
          <p className="mt-2 text-white/70">
            {formatDate(e.starts_at)}
            {e.venue ? ` · ${e.venue}` : ""}
          </p>
          <div className={`mx-auto mt-8 grid max-w-xl gap-3 ${numbers.length > 3 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"}`}>
            {numbers.map((x) => (
              <div key={x.l} className="rounded-3xl bg-white/10 px-3 py-4 backdrop-blur">
                <div className="text-3xl font-extrabold">
                  <CountUp value={x.n} />
                </div>
                <div className="text-xs font-semibold uppercase tracking-wider text-white/70">{x.l}</div>
              </div>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto -mt-8 grid max-w-3xl gap-6 px-4 pb-16">
        {e.thank_you ? (
          <section className="relative rotate-[-0.6deg] rounded-3xl bg-white p-6 text-center shadow-lift">
            <div className="text-3xl">💌</div>
            <p className="mt-2 whitespace-pre-line font-script text-3xl leading-snug text-ink">{e.thank_you}</p>
          </section>
        ) : null}

        {best.length ? (
          <section>
            <h2 className="mb-3 text-xl font-extrabold">{f.voting && best[0].vote_count ? "Most loved moments" : "Moments"}</h2>
            <div className="grid grid-cols-3 gap-2">
              {best.map((b, i) => (
                <div key={b.id} className={`relative overflow-hidden rounded-2xl bg-muted ${i === 0 ? "col-span-2 row-span-2" : ""}`}>
                  <img src={publicUrl(photoKeys(e.id, b.id).md)} alt={b.name ? `Photo by ${b.name}` : "Event photo"} loading="lazy" className="aspect-square size-full object-cover" />
                  {f.voting && b.vote_count ? <span className="absolute bottom-2 right-2 rounded-full bg-black/55 px-2 py-0.5 text-xs font-semibold text-white">❤️ {b.vote_count}</span> : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {f.voting && stats.topSnappers.length ? (
          <section className="rounded-3xl bg-white p-5 shadow-soft">
            <h2 className="text-xl font-extrabold">🏆 Top snappers</h2>
            <ol className="mt-3 grid gap-2">
              {stats.topSnappers.map((s, i) => (
                <li key={s.id} className="flex items-center gap-3 rounded-2xl bg-background px-4 py-2.5">
                  <span className="w-7 text-center text-xl">{MEDALS[i] ?? i + 1}</span>
                  <span className="min-w-0 flex-1 truncate font-semibold">{s.name ?? "Guest"}</span>
                  <span className="text-sm text-muted-foreground">{s.count} photos</span>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {albums.length ? (
          <section>
            <h2 className="mb-3 text-xl font-extrabold">#️⃣ Albums</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {albums.slice(0, 9).map((a) => (
                <Link key={a.tag} href={guestPath(e.slug)} className="relative aspect-square overflow-hidden rounded-3xl bg-ink">
                  {a.cover ? <img src={a.cover} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" /> : null}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-3 text-white">
                    <div className="text-sm font-bold">#{a.tag}</div>
                    <div className="text-xs text-white/80">{a.count} photos</div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {missions.some((m) => m.count) ? (
          <section>
            <h2 className="mb-3 text-xl font-extrabold">🎯 Missions accomplished</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {missions
                .filter((m) => m.count)
                .map((m) => (
                  <div key={m.id} className="relative aspect-square overflow-hidden rounded-3xl bg-ink">
                    {m.cover ? <img src={m.cover} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" /> : null}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-3 text-white">
                      <div className="text-sm font-bold leading-tight">
                        {m.emoji ?? "🎯"} {m.title}
                      </div>
                      <div className="text-xs text-white/80">{m.count} photos</div>
                    </div>
                  </div>
                ))}
            </div>
          </section>
        ) : null}

        {wishes.length ? (
          <section>
            <h2 className="mb-3 text-xl font-extrabold">💌 Wishes</h2>
            <div className="columns-1 gap-3 sm:columns-2">
              {wishes.map((w) => (
                <article key={w.id} className="mb-3 break-inside-avoid rounded-3xl bg-white p-4 shadow-soft">
                  <p className="whitespace-pre-line font-script text-2xl leading-snug text-ink">{w.message}</p>
                  <div className="mt-2 text-xs font-semibold text-brand">— {w.name ?? "A guest"}</div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <section className="grid gap-3 rounded-3xl bg-white p-5 text-center shadow-soft">
          <Link href={guestPath(e.slug)} className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-brand font-bold text-white shadow-cherry">
            Open the full album <ArrowRight className="size-5" aria-hidden />
          </Link>
          {f.guest_album_download ? (
            <a href={`/api/e/${e.slug}/album`} className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-border font-semibold">
              <Download className="size-5" aria-hidden /> Download every photo
            </a>
          ) : null}
        </section>

        {!f.hide_powered_by ? (
          <Link href={APP_URL} className="mx-auto grid justify-items-center gap-1 text-center text-sm text-muted-foreground">
            <span>Made with</span>
            <Logo className="text-base" />
            <span className="font-semibold text-brand">Create an album for your own event →</span>
          </Link>
        ) : null}
      </main>
    </div>
  );
}
