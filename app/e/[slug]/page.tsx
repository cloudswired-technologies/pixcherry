import type { Metadata } from "next";
import { Logo } from "@/components/ui";
import { coverUrl, getEventBySlug, logoUrl } from "@/lib/events";
import { formatDate } from "@/lib/format";
import { currentGuest } from "@/lib/guests";
import { uploadsOpen } from "@/lib/limits";
import { listPhotos } from "@/lib/photos";
import { turnstileSiteKey } from "@/lib/turnstile";
import { GuestApp } from "./guest-app";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const e = await getEventBySlug((await params).slug);
  // Galleries are private links: never indexed.
  return { title: e?.name ?? "Event", robots: { index: false, follow: false } };
}

export default async function GuestPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const e = await getEventBySlug(slug);
  if (!e || !e.paid_at || e.purged_at) {
    return (
      <main className="grid min-h-dvh place-items-center px-6 text-center">
        <div className="grid justify-items-center gap-3">
          <Logo className="text-lg" />
          <h1 className="text-xl font-bold">{e?.purged_at ? "This album has closed" : "Event not found"}</h1>
          <p className="max-w-xs text-sm text-muted-foreground">
            {e?.purged_at ? "The storage period for this event has ended and its photos were deleted." : "Check the QR code or link with the organiser."}
          </p>
        </div>
      </main>
    );
  }
  const guest = await currentGuest(e.id);
  const first = await listPhotos(e.id, { order: "new", limit: 60, guestId: guest?.id ?? null });
  const f = e.cfg.features;
  return (
    <GuestApp
      slug={e.slug}
      event={{
        name: e.name,
        description: e.description,
        date: formatDate(e.starts_at),
        cover: coverUrl(e),
        logo: f.custom_branding ? logoUrl(e) : null,
        accent: (f.custom_branding && e.accent_color) || "#e8553d",
        poweredBy: !f.hide_powered_by,
        askName: e.ask_guest_name,
        review: f.moderation && e.require_approval,
      }}
      canUpload={uploadsOpen(e, e.cfg)}
      guest={guest ? { name: guest.name, uploaded: guest.upload_count, blocked: guest.is_blocked } : null}
      limits={{ perGuest: e.cfg.limits.photos_per_guest, maxBytes: e.cfg.limits.max_file_mb * 1024 * 1024 }}
      quality={{ maxPx: e.cfg.quality.max_px, jpeg: e.cfg.quality.jpeg_quality }}
      albumDownload={f.guest_album_download}
      initial={{ ...first, count: e.photo_count }}
      siteKey={turnstileSiteKey()}
    />
  );
}
