import "server-only";
import QRCode from "qrcode";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import { drawable, font, textPath, wrap } from "@/lib/fonts";

// The table card guests scan: logo, QR, three steps, event name, date, link —
// drawn once as an SVG on the server and handed out as PNG (print or share on
// WhatsApp) or an A5 PDF. The dashboard shows the very same image, so what you
// see is exactly what you download.

const W = 1200;
const H = 1680;
const INK = "#1f2937";
const CHERRY = "#e91d48";
const MUTED = "#6b7280";

export type CardInfo = { name: string; date: string; venue: string; url: string; accent?: string | null };

const LOGO = (x: number, y: number, s: number) => `
  <g transform="translate(${x} ${y}) scale(${s})">
    <path d="M34 28H22a10 10 0 0 0-10 10v38a10 10 0 0 0 10 10h12" fill="none" stroke="${INK}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M86 28h12a10 10 0 0 1 10 10v38a10 10 0 0 1-10 10H86" fill="none" stroke="${INK}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M60 46c0-14 4-26 14-34" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>
    <path d="M72 14c6-10 18-14 30-12-3 12-13 20-26 20-3 0-4-4-4-8z" fill="#16a34a"/>
    <circle cx="60" cy="64" r="24" fill="${CHERRY}"/>
    <circle cx="69" cy="55" r="6" fill="#ffffff"/>
  </g>`;

export async function cardSvg(c: CardInfo) {
  const brand = c.accent && /^#[0-9a-fA-F]{6}$/.test(c.accent) ? c.accent : CHERRY;
  // Logo + wordmark, centred together.
  const markW = 120 * 0.95;
  const wordSize = 78;
  const pix = font("heavy").getAdvanceWidth("Pix", wordSize);
  const cherry = font("heavy").getAdvanceWidth("Cherry", wordSize);
  const total = markW + 18 + pix + cherry;
  const lx = (W - total) / 2;
  const wx = lx + markW + 18;
  // QR, drawn as its own SVG inside the card.
  const qrSize = 560;
  const qrX = (W - qrSize) / 2;
  const qrY = 322;
  const qr = (await QRCode.toString(c.url, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: INK, light: "#ffffff" } }))
    .replace(/<\?xml[^>]*>/, "")
    .replace("<svg ", `<svg x="${qrX}" y="${qrY}" width="${qrSize}" height="${qrSize}" `);
  // Three steps under the QR.
  const steps = ["Scan", "Add your name", "Snap & share"];
  const stepY = 1060;
  const stepXs = [W / 2 - 340, W / 2, W / 2 + 340];
  const name = wrap("script", drawable(font("script"), c.name) || "Our event", 92, W - 200, 2);
  const nameY = 1255;
  const meta = [c.date, c.venue].filter(Boolean).join(" · ");
  const metaY = nameY + (name.length - 1) * 92 + 76;
  const link = c.url.replace(/^https?:\/\//, "");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#ffffff"/>
  <circle cx="${W + 10}" cy="-10" r="150" fill="${brand}"/>
  <circle cx="${W - 120}" cy="-40" r="70" fill="${INK}"/>
  <circle cx="-30" cy="${H + 20}" r="190" fill="${brand}"/>
  <circle cx="190" cy="${H + 40}" r="70" fill="${INK}"/>
  <circle cx="${W + 30}" cy="${H + 30}" r="140" fill="${brand}"/>
  <ellipse cx="${W - 70}" cy="${H - 190}" rx="26" ry="40" transform="rotate(25 ${W - 70} ${H - 190})" fill="#16a34a"/>
  ${LOGO(lx, 105, 0.95)}
  <path d="${textPath("heavy", "Pix", wx, 190, wordSize)}" fill="${INK}"/>
  <path d="${textPath("heavy", "Cherry", wx + pix, 190, wordSize)}" fill="${CHERRY}"/>
  <path d="${textPath("bold", "SHARE YOUR BEST MOMENT", W / 2, 258, 26, "center", 7)}" fill="${INK}" opacity="0.75"/>
  <rect x="${qrX - 28}" y="${qrY - 28}" width="${qrSize + 56}" height="${qrSize + 56}" rx="40" fill="#ffffff" stroke="#f0e4e7" stroke-width="4"/>
  ${qr}
  <path d="${textPath("heavy", "Scan to join our photo album", W / 2, 1000, 50, "center")}" fill="${INK}"/>
  ${steps
    .map((s, i) => {
      const x = stepXs[i];
      return `<circle cx="${x}" cy="${stepY}" r="30" fill="${brand}"/>
  <path d="${textPath("heavy", String(i + 1), x, stepY + 13, 36, "center")}" fill="#ffffff"/>
  <path d="${textPath("bold", s, x, stepY + 78, 32, "center")}" fill="${INK}"/>`;
    })
    .join("\n  ")}
  <path d="M ${stepXs[0] + 50} ${stepY} L ${stepXs[1] - 50} ${stepY} M ${stepXs[1] + 50} ${stepY} L ${stepXs[2] - 50} ${stepY}" stroke="#f0e4e7" stroke-width="4" stroke-dasharray="10 10"/>
  ${name.map((l, i) => `<path d="${textPath("script", l, W / 2, nameY + i * 92, 92, "center")}" fill="${brand}"/>`).join("\n  ")}
  ${meta ? `<path d="${textPath("medium", drawable(font("medium"), meta), W / 2, metaY, 36, "center")}" fill="${MUTED}"/>` : ""}
  <path d="${textPath("bold", link, W / 2, metaY + 62, 32, "center")}" fill="${INK}"/>
</svg>`;
}

export async function cardPng(c: CardInfo) {
  return sharp(Buffer.from(await cardSvg(c)), { density: 96 }).png({ compressionLevel: 8 }).toBuffer();
}

/** A5 portrait, the card centred with a small white margin. */
export async function cardPdf(c: CardInfo) {
  const png = await cardPng(c);
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${c.name} — QR card`);
  pdf.setCreator("PixCherry");
  const page = pdf.addPage([419.53, 595.28]);
  const img = await pdf.embedPng(png);
  const k = Math.min((419.53 - 24) / W, (595.28 - 24) / H);
  const w = W * k;
  const h = H * k;
  page.drawImage(img, { x: (419.53 - w) / 2, y: (595.28 - h) / 2, width: w, height: h });
  return Buffer.from(await pdf.save());
}
