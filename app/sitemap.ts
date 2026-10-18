import type { MetadataRoute } from "next";
import { APP_URL } from "@/lib/env";

// Public marketing pages only. Bump UPDATED when a page's content changes.
const UPDATED = new Date("2026-10-18");

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${APP_URL}/`, lastModified: UPDATED, changeFrequency: "weekly", priority: 1 },
    { url: `${APP_URL}/guide`, lastModified: UPDATED, changeFrequency: "monthly", priority: 0.8 },
    { url: `${APP_URL}/demo`, lastModified: UPDATED, changeFrequency: "weekly", priority: 0.7 },
    { url: `${APP_URL}/privacy`, lastModified: UPDATED, changeFrequency: "yearly", priority: 0.3 },
    { url: `${APP_URL}/terms`, lastModified: UPDATED, changeFrequency: "yearly", priority: 0.3 },
  ];
}
