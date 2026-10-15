import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import opentype from "opentype.js";
import sharp from "sharp";

// Downloads of captioned photos carry the caption with them: a white strip under
// the photo ("caption" + "— Siti · Aina & Hakim's Wedding"), like a Polaroid,
// plus the caption in the file's metadata. The server has no fonts and its image
// library can't set text, so the words are turned into vector outlines here
// (opentype.js) and drawn as an SVG. Fonts ship with the app (Plus Jakarta Sans, OFL).

const dir = join(process.cwd(), "assets", "fonts");
let fonts: { bold: opentype.Font; medium: opentype.Font } | null = null;
function load() {
  const read = (f: string) => {
    const b = readFileSync(join(dir, f));
    return opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
  };
  fonts ??= { bold: read("PlusJakartaSans-700.woff"), medium: read("PlusJakartaSans-500.woff") };
  return fonts;
}

/** Keeps only characters the font can draw (emoji and other scripts would show as boxes). */
function drawable(font: opentype.Font, s: string) {
  return [...s].filter((ch) => ch === " " || font.charToGlyphIndex(ch) > 0).join("").replace(/\s+/g, " ").trim();
}

/** Greedy word wrap to `width` px; at most `max` lines, the last one ending in "…" if cut. */
function wrap(font: opentype.Font, text: string, size: number, width: number, max: number) {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (font.getAdvanceWidth(next, size) <= width || !cur) cur = next;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  if (lines.length > max) {
    const kept = lines.slice(0, max);
    let last = kept[max - 1];
    while (last && font.getAdvanceWidth(`${last}…`, size) > width) last = last.slice(0, -1);
    kept[max - 1] = `${last.trimEnd()}…`;
    return kept;
  }
  return lines;
}

export async function photoWithCaption(photo: Buffer, caption: string, by: string | null, eventName: string) {
  const { bold, medium } = load();
  const base = sharp(photo).rotate();
  const meta = await base.metadata();
  const w = meta.autoOrient?.width ?? meta.width ?? 2000;
  const h = meta.autoOrient?.height ?? meta.height ?? 1500;
  const pad = Math.round(w * 0.05);
  const big = Math.round(w * 0.036);
  const small = Math.round(w * 0.022);
  const text = drawable(bold, caption) || "📷";
  const lines = wrap(bold, text, big, w - pad * 2, 3);
  const credit = wrap(medium, drawable(medium, `— ${by ?? "A guest"} · ${eventName}`), small, w - pad * 2, 1)[0] ?? "";
  const lineH = Math.round(big * 1.25);
  const gap = Math.round(w * 0.014);
  const strip = pad + lines.length * lineH + gap + Math.round(small * 1.3) + pad;
  const paths = [
    ...lines.map((l, i) => bold.getPath(l, pad, pad + big + i * lineH, big).toPathData(2)),
  ];
  const creditPath = medium.getPath(credit, pad, pad + lines.length * lineH + gap + small, small).toPathData(2);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${strip}" viewBox="0 0 ${w} ${strip}">
    <rect width="100%" height="100%" fill="#ffffff"/>
    <path d="${paths.join(" ")}" fill="#1f2937"/>
    <path d="${creditPath}" fill="#6b7280"/>
  </svg>`;
  return base
    .extend({ bottom: strip, background: "#ffffff" })
    .composite([{ input: Buffer.from(svg), top: h, left: 0 }])
    .jpeg({ quality: 90, chromaSubsampling: "4:4:4" })
    .withExif({ IFD0: { ImageDescription: caption.replace(/[^\x20-\x7e]/g, "").trim() || "Photo", Artist: (by ?? "").replace(/[^\x20-\x7e]/g, "") } })
    .toBuffer();
}
