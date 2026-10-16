import { Download, ExternalLink, FileText } from "lucide-react";
import { CopyButton } from "@/components/copy-button";
import { btn, cn } from "@/components/ui";

// The designed QR card (rendered on the server, see lib/qr-card.ts) with its
// download buttons. Used on QR & sharing and on the event overview, so the card
// is the same everywhere.

export function QrCardPanel({ eventId, slug, url, compact }: { eventId: string; slug: string; url: string; compact?: boolean }) {
  const src = `/api/events/${eventId}/card?inline=1&v=${encodeURIComponent(slug)}`;
  return (
    <div className={cn("grid gap-4", compact ? "" : "sm:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] sm:items-start")}>
      <a href={src} target="_blank" rel="noreferrer" className={cn("block overflow-hidden rounded-3xl border border-border bg-white shadow-soft", compact ? "mx-auto w-full max-w-60" : "")}>
        <img src={src} alt="QR card guests scan to join the album" className="block w-full" />
      </a>
      <div className="grid content-start gap-3">
        <div className={cn("grid gap-2", compact ? "grid-cols-2" : "sm:grid-cols-2")}>
          <a href={`/api/events/${eventId}/card?format=pdf`} className={btn("primary", "md")}>
            <FileText aria-hidden /> Download PDF
          </a>
          <a href={`/api/events/${eventId}/card`} className={btn("outline", "md")}>
            <Download aria-hidden /> Download image
          </a>
        </div>
        {compact ? null : (
          <p className="text-sm text-muted-foreground">PDF prints on A5 (or A4, fit to page). The image is for WhatsApp, Instagram or a screen at the entrance.</p>
        )}
        <div className="flex min-w-0 items-center gap-2 rounded-2xl bg-muted px-3 py-2">
          <span className="min-w-0 flex-1 truncate font-mono text-sm">{url.replace(/^https?:\/\//, "")}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <CopyButton text={url} />
          <a href={url} target="_blank" rel="noreferrer" className={btn("outline", "md")}>
            <ExternalLink aria-hidden /> Open guest app
          </a>
        </div>
      </div>
    </div>
  );
}
