import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import opentype from "opentype.js";

// Fonts for images made on the server (caption strips, QR cards). The server has
// no system fonts and its image library can't set text, so text becomes vector
// outlines (SVG paths) drawn with these files. Plus Jakarta Sans + Caveat, OFL.

const dir = join(process.cwd(), "assets", "fonts");
const FILES = { medium: "PlusJakartaSans-500.woff", bold: "PlusJakartaSans-700.woff", heavy: "PlusJakartaSans-800.woff", script: "Caveat-700.woff" } as const;
export type FontName = keyof typeof FILES;
const cache = new Map<FontName, opentype.Font>();

export function font(name: FontName) {
  let f = cache.get(name);
  if (!f) {
    const b = readFileSync(join(dir, FILES[name]));
    f = opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
    cache.set(name, f);
  }
  return f;
}

/** Keeps only characters the font can draw (emoji and other scripts would show as boxes). */
export function drawable(f: opentype.Font, s: string) {
  return [...s].filter((ch) => ch === " " || f.charToGlyphIndex(ch) > 0).join("").replace(/\s+/g, " ").trim();
}

export function width(name: FontName, text: string, size: number, tracking = 0) {
  return font(name).getAdvanceWidth(text, size) + tracking * Math.max(0, [...text].length - 1);
}

/**
 * SVG path data for one line of text. `align` positions x as the left edge,
 * centre or right edge; `tracking` adds space between letters (px).
 */
export function textPath(name: FontName, text: string, x: number, baseline: number, size: number, align: "left" | "center" | "right" = "left", tracking = 0) {
  const f = font(name);
  const w = width(name, text, size, tracking);
  let cx = align === "center" ? x - w / 2 : align === "right" ? x - w : x;
  if (!tracking) return f.getPath(text, cx, baseline, size).toPathData(2);
  const parts: string[] = [];
  for (const ch of text) {
    parts.push(f.getPath(ch, cx, baseline, size).toPathData(2));
    cx += f.getAdvanceWidth(ch, size) + tracking;
  }
  return parts.join(" ");
}

/** Greedy word wrap to `max` px; at most `lines` lines, the last one ending in "…" if cut. */
export function wrap(name: FontName, text: string, size: number, max: number, lines: number) {
  const f = font(name);
  const out: string[] = [];
  let cur = "";
  for (const w of text.split(" ")) {
    const next = cur ? `${cur} ${w}` : w;
    if (f.getAdvanceWidth(next, size) <= max || !cur) cur = next;
    else {
      out.push(cur);
      cur = w;
    }
  }
  if (cur) out.push(cur);
  if (out.length <= lines) return out;
  const kept = out.slice(0, lines);
  let last = kept[lines - 1];
  while (last && f.getAdvanceWidth(`${last}…`, size) > max) last = last.slice(0, -1);
  kept[lines - 1] = `${last.trimEnd()}…`;
  return kept;
}
