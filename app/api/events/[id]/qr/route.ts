import QRCode from "qrcode";
import { currentUser } from "@/lib/auth";
import { APP_URL } from "@/lib/env";
import { getManagedEvent, guestUrl } from "@/lib/events";

// QR code PNG (or SVG with ?format=svg) for printing at the venue.

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return new Response("Unauthorised", { status: 401 });
  const e = await getManagedEvent((await params).id, user);
  if (!e) return new Response("Not found", { status: 404 });
  const url = guestUrl(APP_URL, e.slug);
  const fmt = new URL(req.url).searchParams.get("format");
  const name = e.name.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").slice(0, 40) || "event";
  if (fmt === "svg") {
    const svg = await QRCode.toString(url, { type: "svg", margin: 2, errorCorrectionLevel: "M" });
    return new Response(svg, { headers: { "content-type": "image/svg+xml", "content-disposition": `attachment; filename="${name}-qr.svg"` } });
  }
  const png = await QRCode.toBuffer(url, { type: "png", width: 1200, margin: 2, errorCorrectionLevel: "M" });
  return new Response(new Uint8Array(png), {
    headers: { "content-type": "image/png", "content-disposition": `${fmt === "inline" ? "inline" : "attachment"}; filename="${name}-qr.png"` },
  });
}
