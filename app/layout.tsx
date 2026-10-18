import type { Metadata, Viewport } from "next";
import { Caveat, Plus_Jakarta_Sans } from "next/font/google";
import { APP_URL } from "@/lib/env";
import { OG_IMAGE, SITE_DESCRIPTION, SITE_NAME } from "@/lib/seo";
import "./globals.css";

const font = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap" });
const script = Caveat({ subsets: ["latin"], variable: "--font-caveat", weight: ["500", "700"], display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: { default: "PixCherry: QR code photo sharing for weddings & events", template: "%s | PixCherry" },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  // No og:title/description here: pages that want them set their own, and a shared album link
  // falls back to the album's own title.
  openGraph: { type: "website", siteName: SITE_NAME, locale: "en_MY", images: [OG_IMAGE] },
  twitter: { card: "summary_large_image", images: [OG_IMAGE.url] },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } },
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = { themeColor: "#ffffff", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-MY" className={`${font.variable} ${script.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
