import type { Metadata, Viewport } from "next";
import { Caveat, Plus_Jakarta_Sans } from "next/font/google";
import { APP_URL } from "@/lib/env";
import "./globals.css";

const font = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap" });
const script = Caveat({ subsets: ["latin"], variable: "--font-caveat", weight: ["500", "700"], display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: { default: "PixCherry — Share your best moment", template: "%s · PixCherry" },
  description: "Let your guests capture and share their photos from any event. One QR code. All the memories in one place.",
};

export const viewport: Viewport = { themeColor: "#ffffff", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${font.variable} ${script.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
