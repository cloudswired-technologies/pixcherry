import { APP_URL } from "@/lib/env";

// Shared SEO bits. Marketing pages set their own title/description/canonical; the social
// preview image is one file (public/og/, made by scripts/og-image.mjs from the real screenshots).
// The root layout sets no og:title, so a shared album link still previews with the event's name.

export const SITE_NAME = "PixCherry";
export const SITE_DESCRIPTION =
  "Guests scan one QR code to share photos in a live album, on any phone, no app. Full quality, live slideshow, FPX payment. Free for small weddings & events.";
export const OG_IMAGE = {
  url: "/og/pixcherry-og.jpg",
  width: 1200,
  height: 630,
  alt: "PixCherry: guests scan a QR code and every photo lands in one live album",
};
export const ORG_ID = `${APP_URL}/#organization`;
export const SITE_ID = `${APP_URL}/#website`;
