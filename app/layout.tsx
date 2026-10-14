import type { Metadata, Viewport } from "next";
import { DM_Sans } from "next/font/google";
import { APP_URL } from "@/lib/env";
import "./globals.css";

const font = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: { default: "EventSnap — Everyone's photos. One event album.", template: "%s · EventSnap" },
  description: "Put one QR code at your wedding or event. Guests scan, snap and upload. Everyone's photos come together in one shared gallery.",
};

export const viewport: Viewport = { themeColor: "#f7f4ef", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={font.variable}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
