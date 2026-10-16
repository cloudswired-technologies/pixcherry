import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Camera, Download, Heart, Images, MessageCircle, MessageCircleHeart, Pencil, QrCode, Sparkles, Tv, Users } from "lucide-react";
import { Confirm } from "@/components/confirm";
import QRCode from "qrcode";
import { QrCardPanel } from "@/components/qr-card-panel";
import { PackageBenefits } from "@/components/package-benefits";
import { EventGuide } from "./event-guide";
import { Meter, PhaseBadge } from "@/components/event-bits";
import { Card, LinkButton, Notice, btn } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { one, q } from "@/lib/db";
import { eventStats, listMissions, listWishes, missionBoard } from "@/lib/engage";
import { coverUrl, getManagedEvent, guestUrl } from "@/lib/events";
import { formatBytes, formatDate, formatDateTime, formatMoney, formatRange } from "@/lib/format";
import { albumOpen, deletionSoon, eventPhase, uploadsCloseAt, uploadsOpen } from "@/lib/limits";
import { listPhotos } from "@/lib/photos";
import { photoKeys, publicUrl } from "@/lib/storage";
import { getSetting } from "@/lib/settings";
import { deleteDraft } from "../actions";

const MEDALS = ["🥇", "🥈", "🥉"];
const initial = (n: string | null) => (n ?? "G").trim().charAt(0).toUpperCase() || "G";

function Tile({ icon: Icon, label, value, sub, tone = "ink", children }: { icon: typeof Camera; label: string; value: string; sub?: string; tone?: "ink" | "brand"; children?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
        <span className={`grid size-7 place-items-center rounded-lg ${tone === "brand" ? "bg-brand-soft text-brand" : "bg-muted text-ink"}`}>
          <Icon className="size-4" aria-hidden />
        </span>
        {label}
      </div>
      <div className="mt-2 text-2xl font-extrabold tracking-tight">{value}</div>
      {sub ? <div className="text-xs text-muted-foreground">{sub}</div> : null}
      {children}
    </div>
  );
}

function SectionHead({ title, href, link }: { title: string; href?: string; link?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="text-lg font-bold">{title}</h2>
      {href ? (
        <Link href={href} className="inline-flex items-center gap-1 text-sm font-semibold text-brand">
          {link ?? "See all"} <ArrowRight className="size-4" aria-hidden />
        </Link>
      ) : null}
    </div>
  );
}

export default async function EventOverview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const e = await getManagedEvent(id, user);
  if (!e) notFound();
  const phase = eventPhase(e);
  const range = formatRange(e.starts_at, e.ends_at);
  const base = `/dashboard/events/${e.id}`;

  if (!e.paid_at) {
    return (
      <div className="mx-auto grid max-w-xl gap-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">{e.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{range}</p>
        </div>
        <Card className="grid gap-3">
          <h2 className="text-lg font-bold">One step left</h2>
          <p className="text-sm text-muted-foreground">Choose a package and pay to activate the event. Your QR code is ready straight after.</p>
          <div className="flex flex-wrap gap-2">
            <LinkButton href={`${base}/checkout`} variant="brand">
              Choose a package
            </LinkButton>
            <LinkButton href={`${base}/settings`} variant="outline">
              Edit details
            </LinkButton>
          </div>
        </Card>
        <Confirm action={deleteDraft.bind(null, e.id)} title="Delete this draft?" message="It hasn't been paid for, so nothing else is lost." confirm="Delete draft" className="justify-self-start text-sm text-danger underline">
          Delete this draft
        </Confirm>
      </div>
    );
  }

  const url = guestUrl(e.slug);
  const lim = e.cfg.limits;
  const f = e.cfg.features;
  const [stats, totals, missions, board, wishes, captions, recent, purchases, warnDays] = await Promise.all([
    eventStats(e.id),
    one<{ hearts: number; captions: number }>(
      "select coalesce(sum(vote_count), 0)::int hearts, count(caption)::int captions from photos where event_id = $1 and status = 'ready'",
      [e.id],
    ),
    f.missions ? listMissions(e.id) : Promise.resolve([]),
    f.missions ? missionBoard(e.id) : Promise.resolve(null),
    f.wishes ? listWishes(e.id, { limit: 3 }) : Promise.resolve([]),
    q<{ id: string; caption: string; name: string | null }>(
      "select p.id, p.caption, g.name from photos p left join guests g on g.id = p.guest_id where p.event_id = $1 and p.status = 'ready' and p.caption is not null order by p.ready_at desc limit 4",
      [e.id],
    ),
    listPhotos(e.id, { order: "new", limit: 8 }),
    q<{ id: string; description: string; amount_cents: number; receipt_no: string; paid_at: Date }>(
      "select id, description, amount_cents, receipt_no, paid_at from purchases where event_id = $1 and status = 'paid' order by paid_at desc",
      [e.id],
    ),
    getSetting("warn_days_before_delete"),
  ]);
  const open = uploadsOpen(e, e.cfg);
  const soon = deletionSoon(e, Number(warnDays) || 3);
  const cover = coverUrl(e);
  const perMission = new Map(board?.missions.map((m) => [m.id, m.total]) ?? []);
  const qrSvg = await QRCode.toString(url, { type: "svg", margin: 1, color: { dark: "#1f2937", light: "#ffffff" } });
  // Everything this package can do, as a checklist: done by itself where we can
  // tell, otherwise ticked the first time the host opens it ("tried").
  const ended = phase === "ended";
  const steps = [
    { key: "details", title: "Add a cover photo and venue", text: "Makes the album feel like yours.", href: `${base}/settings`, done: !!e.cover_key || !!e.venue },
    ...(f.missions
      ? [{ key: "missions", title: "Add snap missions", text: "Fun photo challenges — write your own or tap a ready idea.", href: `${base}/missions`, done: missions.length > 0 }]
      : []),
    ...(f.tags
      ? [{ key: "tags", title: "Choose hashtags", text: "Each hashtag becomes an album guests can browse (#family, #food…).", href: `${base}/settings`, done: (e.suggested_tags?.length ?? 0) > 0 }]
      : []),
    { key: "try", title: "Try the guest app yourself", text: albumOpen(e) ? "Scan the QR with your phone and snap the first photo." : "Scan the QR with your phone to preview what guests see. Guests get a countdown until the start time.", href: url, done: e.photo_count > 0, external: true },
    { key: "share", title: "Download the QR card and share it", text: "Print it for the tables or send it on WhatsApp.", href: `${base}/qr`, done: stats.joined > 1 },
    ...(f.slideshow
      ? [{ key: "slideshow", title: "Show the live slideshow on a TV", text: "New photos, wishes and the leaderboard pop up on the big screen.", href: `${url}/slideshow`, done: false, external: true, tried: true }]
      : []),
    ...(f.moderation
      ? [{ key: "approval", title: "Decide on photo approval", text: "Want to check photos before guests see them? Turn it on in Settings.", href: `${base}/settings`, done: e.require_approval, tried: true }]
      : []),
    ...(f.wishes ? [{ key: "wishes", title: "Read the wishes", text: "Guests leave you messages — hide any you don't want on the wall.", href: `${base}/wishes`, done: false, tried: true }] : []),
    { key: "download", title: "Download every photo", text: ended ? "Your album is ready — get the ZIP before it's deleted." : "After the event, download the whole album as one ZIP.", href: `/api/e/${e.slug}/album`, done: false, tried: true, external: true },
    { key: "recap", title: "Share the recap", text: "A beautiful page of the day in numbers, best photos and wishes.", href: `${url}/recap`, done: false, tried: true, external: true },
  ];

  return (
    <div className="grid gap-6">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-ink text-white shadow-lift">
        {cover ? <img src={cover} alt="" className="absolute inset-0 size-full object-cover opacity-40" /> : null}
        <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/85 to-ink/30" />
        <div className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-brand/40 blur-3xl" aria-hidden />
        <div className="relative grid gap-4 p-5 sm:p-7">
          <div className="flex flex-wrap items-center gap-2">
            <PhaseBadge phase={phase} />
            {!e.purged_at ? (
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${open ? "bg-white/15" : "bg-white/10 text-white/70"}`}>
                <span className={`size-1.5 rounded-full ${open ? "bg-[#4ade80]" : "bg-white/50"}`} /> {open ? "Uploads open" : e.paid_at && !albumOpen(e) ? `Opens ${formatDateTime(e.starts_at)}` : "Uploads closed"}
              </span>
            ) : null}
          </div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{e.name}</h1>
            <p className="mt-1 text-sm text-white/70">{[range, e.venue].filter(Boolean).join(" · ")}</p>
          </div>
          {!e.purged_at ? (
            <div className="flex flex-wrap gap-2">
              {e.photo_count > 0 ? (
                <a href={`/api/e/${e.slug}/album`} className={btn("brand", "sm")}>
                  <Download aria-hidden /> Download all photos
                </a>
              ) : null}
              <a href={`/api/events/${e.id}/card?format=pdf`} className={btn("outline", "sm", "border-white/20 bg-white/10 text-white hover:bg-white/20")}>
                <QrCode aria-hidden /> QR card (PDF)
              </a>
              {f.slideshow ? (
                <a href={`${url}/slideshow`} target="_blank" rel="noreferrer" className={btn("outline", "sm", "border-white/20 bg-white/10 text-white hover:bg-white/20")}>
                  <Tv aria-hidden /> Slideshow
                </a>
              ) : null}
              <a href={`${url}/recap`} target="_blank" rel="noreferrer" className={btn("outline", "sm", "border-white/20 bg-white/10 text-white hover:bg-white/20")}>
                <Sparkles aria-hidden /> Recap
              </a>
              <LinkButton href={`${base}/settings`} variant="outline" size="sm" className="border-white/20 bg-white/10 text-white hover:bg-white/20">
                <Pencil aria-hidden /> Edit
              </LinkButton>
            </div>
          ) : null}
        </div>
      </section>

      {e.purged_at ? (
        <Notice tone="danger">The storage period ended on {formatDate(e.purged_at)} and the photos were deleted.</Notice>
      ) : soon ? (
        <Notice tone="warn">
          Photos will be deleted on <strong>{formatDate(e.deletion_at!)}</strong>. Download the album now, or{" "}
          <Link href={`${base}/checkout`} className="font-semibold underline">
            add more storage days
          </Link>
          .
        </Notice>
      ) : null}

      {!e.purged_at ? <EventGuide eventId={e.id} guestUrl={url} qrSvg={qrSvg} steps={steps} /> : null}

      {/* Live numbers — the same ones guests see */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Tile icon={Camera} label="Photos" value={stats.photos.toLocaleString("en-MY")} sub={`of ${lim.max_photos.toLocaleString("en-MY")}`} tone="brand">
          <Meter value={e.photo_count} max={lim.max_photos} />
        </Tile>
        <Tile icon={Users} label="Guests joined" value={stats.joined.toLocaleString("en-MY")} sub={`of ${lim.max_guests.toLocaleString("en-MY")}`}>
          <Meter value={e.guest_count} max={lim.max_guests} />
        </Tile>
        <Tile icon={Images} label="Photographers" value={stats.guests.toLocaleString("en-MY")} sub="guests who shared" />
        <Tile icon={Heart} label="Hearts" value={(totals?.hearts ?? 0).toLocaleString("en-MY")} sub={f.voting ? "on all photos" : "not in package"} tone="brand" />
        <Tile icon={MessageCircleHeart} label="Wishes" value={stats.wishes.toLocaleString("en-MY")} sub={f.wishes ? "on the wall" : "not in package"} />
        <Tile icon={MessageCircle} label="Captions" value={(totals?.captions ?? 0).toLocaleString("en-MY")} sub="photos with a caption" />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Leaderboard */}
        <Card>
          <SectionHead title="🏆 Top snappers" href={`${base}/guests`} link="All guests" />
          {stats.topSnappers.length ? (
            <ol className="grid gap-1.5">
              {stats.topSnappers.slice(0, 5).map((s, i) => (
                <li key={s.id}>
                  <Link href={`${base}/photos?guest=${s.id}`} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-muted">
                    <span className="w-6 text-center text-lg">{MEDALS[i] ?? <span className="text-sm font-bold text-muted-foreground">{i + 1}</span>}</span>
                    <span className="grid size-8 place-items-center rounded-full bg-brand text-sm font-bold text-white">{initial(s.name)}</span>
                    <span className="min-w-0 flex-1 truncate font-semibold">{s.name ?? "Guest"}</span>
                    <span className="text-sm text-muted-foreground">{s.count} 📸</span>
                  </Link>
                </li>
              ))}
            </ol>
          ) : (
            <p className="rounded-xl bg-muted px-4 py-8 text-center text-sm text-muted-foreground">No photos yet.</p>
          )}
        </Card>

        {/* Most loved */}
        <Card>
          <SectionHead title="❤️ Most loved" href={`${base}/photos?sort=top`} />
          {stats.topPhotos.length ? (
            <div className="grid grid-cols-3 gap-2">
              {stats.topPhotos.slice(0, 6).map((p, i) => (
                <a key={p.id} href={p.md} target="_blank" rel="noreferrer" className={`relative overflow-hidden rounded-xl bg-muted ${i === 0 ? "col-span-2 row-span-2" : ""}`}>
                  <img src={i === 0 ? p.md : p.sm} alt={p.by ? `Photo by ${p.by}` : "Event photo"} loading="lazy" className="aspect-square size-full object-cover" />
                  <span className="absolute bottom-1.5 right-1.5 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-semibold text-white">
                    <Heart className="size-3 fill-white" aria-hidden /> {p.votes}
                  </span>
                </a>
              ))}
            </div>
          ) : (
            <p className="rounded-xl bg-muted px-4 py-8 text-center text-sm text-muted-foreground">{f.voting ? "Hearts show up here once guests start loving photos." : "Hearts aren't in this package."}</p>
          )}
        </Card>
      </div>

      {f.missions ? (
        <Card>
          <SectionHead title="🎯 Missions" href={`${base}/missions`} link="Manage" />
          {missions.length ? (
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
              <ul className="grid gap-2">
                {missions.map((m) => {
                  const done = perMission.get(m.id) ?? 0;
                  const pct = stats.joined ? Math.min(100, (done / stats.joined) * 100) : 0;
                  return (
                    <li key={m.id} className="rounded-xl bg-background px-3 py-2.5">
                      <div className="flex items-center gap-2 text-sm">
                        <span>{m.emoji ?? "🎯"}</span>
                        <span className="min-w-0 flex-1 truncate font-semibold">{m.title}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {done} done · {m.count} photo{m.count === 1 ? "" : "s"}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
              <div className="rounded-2xl bg-gradient-to-br from-[#fff4e0] to-brand-soft p-4">
                <h3 className="font-bold">Mission masters</h3>
                <p className="text-xs text-muted-foreground">Completed every mission, fastest first.</p>
                {board?.finishers.length ? (
                  <ol className="mt-3 grid gap-1.5">
                    {board.finishers.slice(0, 5).map((x, i) => (
                      <li key={x.id} className="flex items-center gap-2 text-sm">
                        <span className="w-6 text-center">{MEDALS[i] ?? i + 1}</span>
                        <span className="min-w-0 flex-1 truncate font-semibold">{x.name ?? "Guest"}</span>
                        <span className="text-xs text-muted-foreground">{new Date(x.at).toLocaleTimeString("en-MY", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kuala_Lumpur" })}</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">Nobody has finished them all yet.</p>
                )}
              </div>
            </div>
          ) : (
            <p className="rounded-xl bg-muted px-4 py-8 text-center text-sm text-muted-foreground">
              No missions yet.{" "}
              <Link href={`${base}/missions`} className="font-semibold text-brand underline">
                Add your first mission
              </Link>
              .
            </p>
          )}
        </Card>
      ) : null}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        {/* Latest photos */}
        <Card>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold">Latest photos</h2>
            <div className="flex gap-2">
              <LinkButton href={`${base}/photos`} variant="outline" size="sm">
                Manage
              </LinkButton>
            </div>
          </div>
          {recent.photos.length ? (
            <div className="grid grid-cols-4 gap-1.5">
              {recent.photos.map((p) => (
                <img key={p.id} src={p.sm} alt="" loading="lazy" className="aspect-square w-full rounded-lg bg-muted object-cover" />
              ))}
            </div>
          ) : (
            <p className="rounded-xl bg-muted px-4 py-8 text-center text-sm text-muted-foreground">No photos yet. Share the QR code and they&apos;ll show up here.</p>
          )}
        </Card>

        {/* QR card — the same design guests see on the tables */}
        <Card className="grid content-start gap-3">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <QrCode className="size-5" aria-hidden /> Guest QR card
            </h2>
            <Link href={`${base}/qr`} className="text-sm font-semibold text-brand">
              QR & sharing
            </Link>
          </div>
          {!e.purged_at ? (
            <>
              <QrCardPanel eventId={e.id} slug={e.slug} url={url} compact />
              <p className="text-center text-xs text-muted-foreground">Guests can upload until {formatDateTime(uploadsCloseAt(e.ends_at, e.cfg))}.</p>
            </>
          ) : null}
        </Card>
      </div>

      {wishes.length || captions.length ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {f.wishes ? (
            <Card>
              <SectionHead title="💌 Latest wishes" href={`${base}/wishes`} />
              {wishes.length ? (
                <ul className="grid gap-2">
                  {wishes.map((w) => (
                    <li key={w.id} className="rounded-xl bg-background p-3">
                      <p className="line-clamp-3 font-script text-xl leading-snug">{w.message}</p>
                      <div className="mt-1 text-xs font-semibold text-brand">— {w.name ?? "A guest"}</div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No wishes yet.</p>
              )}
            </Card>
          ) : null}
          <Card>
            <SectionHead title="💬 Latest captions" href={`${base}/photos`} link="All photos" />
            {captions.length ? (
              <ul className="grid gap-2">
                {captions.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 rounded-xl bg-background p-2.5 text-sm">
                    <img src={publicUrl(photoKeys(e.id, c.id).sm)} alt="" className="size-12 shrink-0 rounded-lg object-cover" />
                    <span className="min-w-0">
                      <span className="line-clamp-2">{c.caption}</span>
                      <span className="text-xs font-semibold text-brand">— {c.name ?? "A guest"}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No captions yet. Guests add them when they share a photo.</p>
            )}
          </Card>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="grid content-start gap-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-bold">{e.plan_snapshot!.name} package</h2>
            {!e.purged_at ? (
              <LinkButton href={`${base}/checkout`} variant="outline" size="sm">
                Upgrade
              </LinkButton>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">
            {formatBytes(Number(e.bytes_used))} stored · photos deleted on {e.deletion_at ? formatDate(e.deletion_at) : "—"}
          </p>
          <PackageBenefits cfg={e.cfg} addons={(e.addon_totals ?? {}) as Record<string, number>} compact />
        </Card>
        <Card className="grid content-start gap-2">
          <h2 className="text-lg font-bold">Payments</h2>
          <ul className="divide-y divide-border text-sm">
            {purchases.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{p.description}</span>
                  <span className="text-xs text-muted-foreground">
                    {p.receipt_no} · {formatDate(p.paid_at)}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  {formatMoney(p.amount_cents)}
                  <Link href={`/dashboard/receipts/${p.id}`} className="text-xs font-semibold underline">
                    Receipt
                  </Link>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      {e.overrides?.note && user.is_admin ? <Notice>Admin note: {e.overrides.note}</Notice> : null}
    </div>
  );
}
