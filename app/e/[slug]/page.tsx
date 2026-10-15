import type { Metadata, Viewport } from "next";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { Logo } from "@/components/ui";
import { eventStats, listMissions, listTagAlbums, missionsDoneBy } from "@/lib/engage";
import { suggestedTags } from "@/lib/tags";
import { coverUrl, getEventBySlug, guestPath, guestUrl, logoUrl, renamedSlug } from "@/lib/events";
import { formatDate } from "@/lib/format";
import { currentGuest, currentGuestKey } from "@/lib/guests";
import { eventPhase, uploadsOpen } from "@/lib/limits";
import { listPhotos } from "@/lib/photos";
import { turnstileSiteKey } from "@/lib/turnstile";
import { GuestApp } from "./guest-app";

export const dynamic = "force-dynamic";

export const viewport: Viewport = { themeColor: "#ffffff" };

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const e = await getEventBySlug((await params).slug);
  if (!e) return { title: "Event", robots: { index: false, follow: false } };
  // Galleries are private links: never indexed. Each one installs as its own home-screen
  // app, which starts signed in as this guest (the key is in the manifest's start link).
  const key = await currentGuestKey(e.id);
  return {
    title: e.name,
    robots: { index: false, follow: false },
    manifest: `${guestPath(e.slug)}/manifest.webmanifest${key ? `?k=${encodeURIComponent(key)}` : ""}`,
    appleWebApp: { capable: true, title: e.name.slice(0, 30), statusBarStyle: "default" },
  };
}

export default async function GuestPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const e = await getEventBySlug(slug);
  if (!e) {
    // The organiser changed the link: old QR codes still land on the album.
    const moved = await renamedSlug(slug);
    if (moved) redirect(guestUrl(moved));
  }
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
  const f = e.cfg.features;
  const share = guestUrl(e.slug);
  const [first, missions, done, stats, tagAlbums, key, qr] = await Promise.all([
    listPhotos(e.id, { order: "new", limit: 60, viewer: guest?.id ?? null }),
    f.missions ? listMissions(e.id) : Promise.resolve([]),
    f.missions && guest ? missionsDoneBy(guest.id) : Promise.resolve([]),
    eventStats(e.id),
    f.tags ? listTagAlbums(e.id) : Promise.resolve([]),
    guest ? currentGuestKey(e.id) : Promise.resolve(null),
    QRCode.toString(share, { type: "svg", margin: 1, color: { dark: "#1f2937", light: "#ffffff" } }),
  ]);
  return (
    <GuestApp
      slug={e.slug}
      base={guestPath(e.slug)}
      shareUrl={share}
      qrSvg={qr}
      resumeKey={key}
      event={{
        name: e.name,
        description: e.description,
        venue: e.venue,
        date: formatDate(e.starts_at),
        cover: coverUrl(e),
        logo: f.custom_branding ? logoUrl(e) : null,
        accent: (f.custom_branding && e.accent_color) || "#e91d48",
        poweredBy: !f.hide_powered_by,
        askName: e.ask_guest_name,
        review: f.moderation && e.require_approval,
        cameraOnly: f.camera && e.camera_only,
        ended: eventPhase(e) === "ended",
      }}
      features={{
        camera: f.camera,
        wishes: f.wishes,
        voting: f.voting,
        missions: f.missions,
        albumDownload: f.guest_album_download,
        tags: f.tags,
        slideshow: f.slideshow,
      }}
      suggestedTags={suggestedTags(e)}
      tagAlbums={tagAlbums}
      canUpload={uploadsOpen(e, e.cfg)}
      guest={guest ? { id: guest.id, name: guest.name, uploaded: guest.upload_count, blocked: guest.is_blocked } : null}
      limits={{ perGuest: e.cfg.limits.photos_per_guest, maxBytes: e.cfg.limits.max_file_mb * 1024 * 1024 }}
      initial={{ ...first, count: e.photo_count }}
      missions={missions}
      missionsDone={done}
      stats={{ ...stats, topSnappers: f.voting ? stats.topSnappers : [], topPhotos: f.voting ? stats.topPhotos : [] }}
      siteKey={turnstileSiteKey()}
    />
  );
}
