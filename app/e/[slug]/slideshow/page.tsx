import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { getEventBySlug, guestUrl } from "@/lib/events";
import { Slideshow } from "./slideshow";

export const dynamic = "force-dynamic";
export const metadata = { title: "Slideshow", robots: { index: false, follow: false } };

export default async function SlideshowPage({ params }: { params: Promise<{ slug: string }> }) {
  const e = await getEventBySlug((await params).slug);
  if (!e || !e.paid_at || e.purged_at || !e.cfg.features.slideshow) notFound();
  const qr = await QRCode.toString(guestUrl(e.slug), { type: "svg", margin: 1, color: { dark: "#1c1917", light: "#ffffff" } });
  return <Slideshow slug={e.slug} name={e.name} qrSvg={qr} voting={e.cfg.features.voting} wishes={e.cfg.features.wishes} />;
}
