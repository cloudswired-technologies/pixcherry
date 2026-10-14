import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { Logo } from "@/components/brand";
import { PrintButton } from "@/components/print-button";
import { requireUser } from "@/lib/auth";
import { APP_URL } from "@/lib/env";
import { getManagedEvent, guestUrl } from "@/lib/events";
import { formatDate } from "@/lib/format";

export const metadata = { title: "QR card" };

// Printable table card, after the brand guide's acrylic stand: logo, QR,
// "Scan & Share", the event name, and cherry shapes in the corners.
export default async function QrCard({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const e = await getManagedEvent(id, user);
  if (!e || !e.paid_at) notFound();
  const url = guestUrl(APP_URL, e.slug);
  const svg = await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#1f2937", light: "#ffffff" } });
  return (
    <div className="grid justify-items-center gap-6 print:block">
      <div className="flex flex-wrap items-center justify-center gap-3 print:hidden">
        <PrintButton />
        <p className="text-sm text-muted-foreground">Prints on A5/A4. Put it in a stand at each table or at the entrance.</p>
      </div>
      <div className="relative aspect-[3/4] w-full max-w-md overflow-hidden rounded-[2rem] bg-white px-10 pb-12 pt-16 text-center shadow-lift print:max-w-none print:rounded-none print:shadow-none">
        {/* cherry shapes (kept to the corners, clear of the logo) */}
        <span className="absolute -right-14 -top-14 size-28 rounded-full bg-brand" aria-hidden />
        <span className="absolute -right-6 -top-16 size-16 rounded-full bg-ink" aria-hidden />
        <span className="absolute -bottom-14 -left-12 size-36 rounded-full bg-brand" aria-hidden />
        <span className="absolute -bottom-9 left-12 size-14 rounded-full bg-ink" aria-hidden />
        <span className="absolute -bottom-12 -right-8 size-24 rounded-full bg-brand" aria-hidden />
        <span className="absolute bottom-8 right-3 h-10 w-6 rotate-[25deg] rounded-[50%_50%_50%_50%/60%_60%_40%_40%] bg-leaf" aria-hidden />

        <div className="relative grid justify-items-center">
          <Logo className="text-3xl" tagline />
          <div className="mx-auto mt-8 w-56 [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
          <p className="mt-6 text-2xl font-extrabold leading-tight text-ink">
            Scan & share
            <br />
            your photos
          </p>
          <p className="mt-4 font-script text-3xl font-bold leading-none text-brand">{e.name}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {formatDate(e.starts_at)}
            {e.venue ? ` · ${e.venue}` : ""}
          </p>
          <p className="mt-4 break-all font-mono text-[11px] text-muted-foreground">{url.replace(/^https?:\/\//, "")}</p>
        </div>
      </div>
    </div>
  );
}
