import { currentUser } from "@/lib/auth";
import { getManagedEvent, guestUrl } from "@/lib/events";
import { formatDate } from "@/lib/format";
import { cardPdf, cardPng } from "@/lib/qr-card";

// The designed QR table card: ?format=pdf (A5) or PNG (default). ?inline=1
// shows it in the page instead of downloading.

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return new Response("Unauthorised", { status: 401 });
  const e = await getManagedEvent((await params).id, user);
  if (!e || !e.paid_at || e.purged_at) return new Response("Not found", { status: 404 });
  const sp = new URL(req.url).searchParams;
  const info = { name: e.name, date: formatDate(e.starts_at), venue: e.venue, url: guestUrl(e.slug), accent: e.cfg.features.custom_branding ? e.accent_color : null };
  const file = e.name.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").slice(0, 40) || "event";
  const disposition = sp.get("inline") ? "inline" : "attachment";
  if (sp.get("format") === "pdf") {
    return new Response(new Uint8Array(await cardPdf(info)), {
      headers: { "content-type": "application/pdf", "content-disposition": `${disposition}; filename="${file}-qr-card.pdf"`, "cache-control": "private, no-store" },
    });
  }
  return new Response(new Uint8Array(await cardPng(info)), {
    headers: { "content-type": "image/png", "content-disposition": `${disposition}; filename="${file}-qr-card.png"`, "cache-control": "private, no-store" },
  });
}
