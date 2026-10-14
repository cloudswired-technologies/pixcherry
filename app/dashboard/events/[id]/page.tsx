import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, ExternalLink, Printer, QrCode, Tv } from "lucide-react";
import { CopyButton } from "@/components/copy-button";
import { Meter, PhaseBadge } from "@/components/event-bits";
import { planLines } from "@/components/plan-card";
import { Badge, Card, LinkButton, Notice, PageHeader, Stat, btn } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { q } from "@/lib/db";
import { APP_URL } from "@/lib/env";
import { getManagedEvent, guestUrl } from "@/lib/events";
import { formatBytes, formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { deletionSoon, eventPhase, uploadsCloseAt, uploadsOpen } from "@/lib/limits";
import { listPhotos } from "@/lib/photos";
import { getSetting } from "@/lib/settings";
import { deleteDraft } from "../actions";

export default async function EventOverview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const e = await getManagedEvent(id, user);
  if (!e) notFound();
  const phase = eventPhase(e);
  const range = `${formatDateTime(e.starts_at)} – ${formatDateTime(e.ends_at)}`;

  if (!e.paid_at) {
    const del = deleteDraft.bind(null, e.id);
    return (
      <div className="mx-auto grid max-w-xl gap-6">
        <PageHeader title={e.name} sub={range} actions={<PhaseBadge phase={phase} />} />
        <Card className="grid gap-3">
          <h2 className="text-lg font-bold">One step left</h2>
          <p className="text-sm text-muted-foreground">Choose a package and pay to activate the event. Your QR code is ready straight after.</p>
          <div className="flex flex-wrap gap-2">
            <LinkButton href={`/dashboard/events/${e.id}/checkout`} variant="brand">
              Choose a package
            </LinkButton>
            <LinkButton href={`/dashboard/events/${e.id}/settings`} variant="outline">
              Edit details
            </LinkButton>
          </div>
        </Card>
        <form action={del}>
          <button className="text-sm text-danger underline">Delete this draft</button>
        </form>
      </div>
    );
  }

  const url = guestUrl(APP_URL, e.slug);
  const lim = e.cfg.limits;
  const [recent, purchases, warnDays] = await Promise.all([
    listPhotos(e.id, { order: "new", limit: 12 }),
    q<{ id: string; description: string; amount_cents: number; receipt_no: string; paid_at: Date }>(
      "select id, description, amount_cents, receipt_no, paid_at from purchases where event_id = $1 and status = 'paid' order by paid_at desc",
      [e.id],
    ),
    getSetting("warn_days_before_delete"),
  ]);
  const open = uploadsOpen(e, e.cfg);
  const soon = deletionSoon(e, Number(warnDays) || 3);
  const snap = e.plan_snapshot!;

  return (
    <div className="grid gap-6">
      <PageHeader title={e.name} sub={range} actions={<PhaseBadge phase={phase} />} />

      {e.purged_at ? (
        <Notice tone="danger">The storage period ended on {formatDate(e.purged_at)} and the photos were deleted.</Notice>
      ) : soon ? (
        <Notice tone="warn">
          Photos will be deleted on <strong>{formatDate(e.deletion_at!)}</strong>. Download the album now, or{" "}
          <Link href={`/dashboard/events/${e.id}/checkout`} className="font-semibold underline">
            add more storage days
          </Link>
          .
        </Notice>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="text-xs font-medium text-muted-foreground">Photos</div>
          <div className="mt-1 text-2xl font-bold">{e.photo_count.toLocaleString("en-MY")}</div>
          <div className="text-xs text-muted-foreground">of {lim.max_photos.toLocaleString("en-MY")}</div>
          <Meter value={e.photo_count} max={lim.max_photos} />
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="text-xs font-medium text-muted-foreground">Guests</div>
          <div className="mt-1 text-2xl font-bold">{e.guest_count.toLocaleString("en-MY")}</div>
          <div className="text-xs text-muted-foreground">of {lim.max_guests.toLocaleString("en-MY")}</div>
          <Meter value={e.guest_count} max={lim.max_guests} />
        </div>
        <Stat label="Storage used" value={formatBytes(Number(e.bytes_used))} hint={`${lim.photos_per_guest} photos per guest`} />
        <Stat label="Photos deleted on" value={e.deletion_at ? formatDate(e.deletion_at) : "—"} hint={`${lim.retention_days} days after the event`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <Card className="grid gap-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <QrCode className="size-5" aria-hidden /> Guest QR code
            </h2>
            {open ? <Badge tone="ok">Uploads open</Badge> : <Badge tone="neutral">Uploads closed</Badge>}
          </div>
          {!e.purged_at ? (
            <>
              <img src={`/api/events/${e.id}/qr?format=inline&v=${e.slug}`} alt="QR code for the guest page" className="mx-auto w-full max-w-60 rounded-xl border border-border bg-white" />
              <div className="break-all rounded-xl bg-muted px-3 py-2 text-center font-mono text-sm">{url}</div>
              <div className="flex flex-wrap justify-center gap-2">
                <CopyButton text={url} />
                <a href={`/api/events/${e.id}/qr`} className={btn("outline")}>
                  <Download aria-hidden /> PNG
                </a>
                <LinkButton href={`/dashboard/events/${e.id}/qr`} variant="outline">
                  <Printer aria-hidden /> Print card
                </LinkButton>
                <a href={url} target="_blank" rel="noreferrer" className={btn("outline")}>
                  <ExternalLink aria-hidden /> Open
                </a>
                {e.cfg.features.slideshow ? (
                  <a href={`${url}/slideshow`} target="_blank" rel="noreferrer" className={btn("outline")}>
                    <Tv aria-hidden /> Slideshow
                  </a>
                ) : null}
              </div>
              <p className="text-center text-xs text-muted-foreground">
                Guests can upload until {formatDateTime(uploadsCloseAt(e.ends_at, e.cfg))}.
              </p>
            </>
          ) : null}
        </Card>

        <Card className="grid content-start gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold">Latest photos</h2>
            <div className="flex gap-2">
              {e.photo_count > 0 && !e.purged_at ? (
                <a href={`/api/e/${e.slug}/album`} className={btn("primary", "sm")}>
                  <Download aria-hidden /> Download album
                </a>
              ) : null}
              <LinkButton href={`/dashboard/events/${e.id}/photos`} variant="outline" size="sm">
                Manage
              </LinkButton>
            </div>
          </div>
          {recent.photos.length ? (
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
              {recent.photos.map((p) => (
                <img key={p.id} src={p.sm} alt="" loading="lazy" className="aspect-square w-full rounded-lg bg-muted object-cover" />
              ))}
            </div>
          ) : (
            <p className="rounded-xl bg-muted px-4 py-8 text-center text-sm text-muted-foreground">No photos yet. Share the QR code and they&apos;ll show up here.</p>
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="grid content-start gap-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-bold">{snap.name} package</h2>
            {!e.purged_at ? (
              <LinkButton href={`/dashboard/events/${e.id}/checkout`} variant="outline" size="sm">
                Upgrade or add more
              </LinkButton>
            ) : null}
          </div>
          <ul className="grid gap-1.5 text-sm text-muted-foreground">
            {planLines({ limits: e.cfg.limits, features: e.cfg.features, quality: e.cfg.quality, highlights: [] }).map((l) => (
              <li key={l}>• {l}</li>
            ))}
          </ul>
        </Card>
        <Card className="grid content-start gap-3">
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
