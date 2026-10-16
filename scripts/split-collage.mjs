// Cut a photo collage (photos on a white grid) into separate JPEGs for tests and demos.
// Finds the white gutters itself. Usage:
//   node scripts/split-collage.mjs <collage.png> <out-dir> [upscale=2]
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const [src, out, up = "2"] = process.argv.slice(2);
if (!src || !out) throw new Error("usage: node scripts/split-collage.mjs <collage> <out-dir> [upscale]");
const { data, info } = await sharp(src).removeAlpha().greyscale().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H } = info;

// A gutter line is (almost) all white.
const isWhiteCol = (x) => {
  let white = 0;
  for (let y = 0; y < H; y++) if (data[y * W + x] > 240) white++;
  return white / H > 0.97;
};
const isWhiteRow = (y) => {
  let white = 0;
  for (let x = 0; x < W; x++) if (data[y * W + x] > 240) white++;
  return white / W > 0.97;
};
// Turn a run of non-gutter lines into [start, end) spans; ignore slivers.
const spans = (n, white) => {
  const s = [];
  let start = -1;
  for (let i = 0; i <= n; i++) {
    const w = i === n || white(i);
    if (!w && start < 0) start = i;
    if (w && start >= 0) {
      if (i - start > 40) s.push([start, i]);
      start = -1;
    }
  }
  return s;
};
const cols = spans(W, isWhiteCol);
const rows = spans(H, isWhiteRow);
console.log(`${W}x${H}: ${cols.length} columns × ${rows.length} rows`);
mkdirSync(out, { recursive: true });
let n = 0;
for (const [y0, y1] of rows) {
  for (const [x0, x1] of cols) {
    n++;
    // Trim 2 px so no gutter edge is left on the photo.
    const left = x0 + 2;
    const top = y0 + 2;
    const w = x1 - x0 - 4;
    const h = y1 - y0 - 4;
    const file = join(out, `photo-${String(n).padStart(2, "0")}.jpg`);
    await sharp(src)
      .extract({ left, top, width: w, height: h })
      .resize({ width: Math.round(w * Number(up)), kernel: "lanczos3" })
      .sharpen({ sigma: 0.6 })
      .jpeg({ quality: 90 })
      .toFile(file);
  }
}
console.log(`wrote ${n} photos to ${out}`);
