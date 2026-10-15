import "server-only";
import { join } from "node:path";
import sharp from "sharp";

// Downloads of captioned photos carry the caption with them: a white strip under
// the photo ("caption" + "— Siti · Aina & Hakim's Wedding"), like a Polaroid,
// plus the caption in the file's metadata. The server has no system fonts, so the
// app ships its own (Plus Jakarta Sans, OFL).

const FONT = join(process.cwd(), "assets", "fonts", "PlusJakartaSans.ttf");
const EMOJI = /[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function line(text: string, sizePx: number, colour: string, weight: "Bold" | "Medium", width: number) {
  return sharp({
    text: {
      text: `<span foreground="${colour}">${esc(text)}</span>`,
      font: `Plus Jakarta Sans ${weight} ${sizePx}`,
      fontfile: FONT,
      width,
      dpi: 72,
      rgba: true,
      wrap: "word",
    },
  })
    .png()
    .toBuffer({ resolveWithObject: true });
}

export async function photoWithCaption(photo: Buffer, caption: string, by: string | null, eventName: string) {
  const base = sharp(photo).rotate();
  const meta = await base.metadata();
  const w = meta.autoOrient?.width ?? meta.width ?? 2000;
  const h = meta.autoOrient?.height ?? meta.height ?? 1500;
  const pad = Math.round(w * 0.05);
  const text = caption.replace(EMOJI, "").replace(/\s+/g, " ").trim() || caption;
  const big = await line(text, Math.round(w * 0.036), "#1f2937", "Bold", w - pad * 2);
  const small = await line(`— ${by ?? "A guest"} · ${eventName}`, Math.round(w * 0.022), "#6b7280", "Medium", w - pad * 2);
  const gap = Math.round(w * 0.012);
  const strip = pad + big.info.height + gap + small.info.height + pad;
  return base
    .extend({ bottom: strip, background: "#ffffff" })
    .composite([
      { input: big.data, top: h + pad, left: pad },
      { input: small.data, top: h + pad + big.info.height + gap, left: pad },
    ])
    .jpeg({ quality: 90, chromaSubsampling: "4:4:4" })
    .withExif({ IFD0: { ImageDescription: caption, Artist: by ?? "" } })
    .toBuffer();
}
