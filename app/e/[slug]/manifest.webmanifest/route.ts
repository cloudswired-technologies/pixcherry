import { NextResponse } from "next/server";
import { getEventBySlug, guestPath } from "@/lib/events";

// Each event installs as its own home-screen app ("Aina & Hakim" with the
// PixCherry icon). With ?k=… the app starts signed in as that guest.

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const e = await getEventBySlug(slug);
  if (!e || !e.paid_at || e.purged_at) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const base = guestPath(e.slug);
  const key = new URL(req.url).searchParams.get("k");
  const short = e.name.length > 14 ? `${e.name.slice(0, 13).trim()}…` : e.name;
  return NextResponse.json(
    {
      id: base,
      name: e.name,
      short_name: short,
      description: "Shared photo album — snap, share and relive the day.",
      start_url: key && key.length < 600 ? `${base}/resume?k=${encodeURIComponent(key)}` : base,
      scope: base,
      display: "standalone",
      orientation: "portrait",
      background_color: "#f7f2ec",
      theme_color: "#ffffff",
      icons: [
        { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    },
    { headers: { "content-type": "application/manifest+json", "cache-control": "no-store" } },
  );
}
