import "server-only";
import sharp from "sharp";
import { drawable, font, textPath, wrap } from "@/lib/fonts";

// Downloads of captioned photos carry the caption with them: a white strip under
// the photo ("caption" + "— Siti · Aina & Hakim's Wedding"), like a Polaroid,
// plus the caption in the file's metadata. Text is drawn as vector paths
// (lib/fonts.ts) because the server has no fonts.

export async function photoWithCaption(photo: Buffer, caption: string, by: string | null, eventName: string) {
  const base = sharp(photo).rotate();
  const meta = await base.metadata();
  const w = meta.autoOrient?.width ?? meta.width ?? 2000;
  const h = meta.autoOrient?.height ?? meta.height ?? 1500;
  const pad = Math.round(w * 0.05);
  const big = Math.round(w * 0.036);
  const small = Math.round(w * 0.022);
  const text = drawable(font("bold"), caption) || "Photo";
  const lines = wrap("bold", text, big, w - pad * 2, 3);
  const credit = wrap("medium", drawable(font("medium"), `— ${by ?? "A guest"} · ${eventName}`), small, w - pad * 2, 1)[0] ?? "";
  const lineH = Math.round(big * 1.25);
  const gap = Math.round(w * 0.014);
  const strip = pad + lines.length * lineH + gap + Math.round(small * 1.3) + pad;
  const paths = lines.map((l, i) => textPath("bold", l, pad, pad + big + i * lineH, big)).join(" ");
  const creditPath = textPath("medium", credit, pad, pad + lines.length * lineH + gap + small, small);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${strip}" viewBox="0 0 ${w} ${strip}">
    <rect width="100%" height="100%" fill="#ffffff"/>
    <path d="${paths}" fill="#1f2937"/>
    <path d="${creditPath}" fill="#6b7280"/>
  </svg>`;
  return base
    .extend({ bottom: strip, background: "#ffffff" })
    .composite([{ input: Buffer.from(svg), top: h, left: 0 }])
    .jpeg({ quality: 90, chromaSubsampling: "4:4:4" })
    .withExif({ IFD0: { ImageDescription: caption.replace(/[^\x20-\x7e]/g, "").trim() || "Photo", Artist: (by ?? "").replace(/[^\x20-\x7e]/g, "") } })
    .toBuffer();
}
