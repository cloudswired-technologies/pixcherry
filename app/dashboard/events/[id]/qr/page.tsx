import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { PrintButton } from "@/components/print-button";
import { requireUser } from "@/lib/auth";
import { APP_URL } from "@/lib/env";
import { getManagedEvent, guestUrl } from "@/lib/events";
import { formatDate } from "@/lib/format";

export const metadata = { title: "QR card" };

// Printable A5-ish card for the venue table.
export default async function QrCard({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const e = await getManagedEvent(id, user);
  if (!e || !e.paid_at) notFound();
  const url = guestUrl(APP_URL, e.slug);
  const svg = await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#1c1917", light: "#ffffff" } });
  const accent = (e.cfg.features.custom_branding && e.accent_color) || "#e8553d";
  return (
    <div className="grid justify-items-center gap-6 print:block">
      <div className="print:hidden">
        <PrintButton />
      </div>
      <div className="w-full max-w-md rounded-3xl border border-border bg-white p-10 text-center shadow-soft print:max-w-none print:border-0 print:shadow-none">
        <div className="text-sm font-semibold uppercase tracking-[0.2em]" style={{ color: accent }}>
          Share your photos
        </div>
        <h1 className="mt-3 text-3xl font-bold leading-tight text-ink">{e.name}</h1>
        <div className="mt-1 text-sm text-muted-foreground">{formatDate(e.starts_at)}</div>
        <div className="mx-auto mt-8 w-64 [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
        <p className="mt-8 text-lg font-semibold text-ink">Scan with your phone camera</p>
        <p className="mt-1 text-sm text-muted-foreground">Take or pick photos and add them to our album. No app needed.</p>
        <p className="mt-6 break-all font-mono text-xs text-muted-foreground">{url.replace(/^https?:\/\//, "")}</p>
      </div>
    </div>
  );
}
