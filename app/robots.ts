import type { MetadataRoute } from "next";
import { APP_URL } from "@/lib/env";

// Everything may be crawled except the API and admin. Private pages stay out of search with
// noindex, not with Disallow (a blocked page can't show its noindex): guest albums
// (app/e/[slug] + an X-Robots-Tag on the guest host, see proxy.ts), login, dashboard, find.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/admin"] },
    sitemap: `${APP_URL}/sitemap.xml`,
    host: APP_URL,
  };
}
