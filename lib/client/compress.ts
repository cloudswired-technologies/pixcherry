// Runs in the guest's browser: turns a picked photo into what we upload.
// Resizing on the phone keeps uploads fast on venue 4G and storage cheap.
// HEIC (iPhone) is always converted because the server only accepts JPEG/PNG/WebP.
// Canvas output carries no EXIF, so location data never leaves the phone.

export type Quality = { maxPx: number | null; jpeg: number };

const PASS_THROUGH = ["image/jpeg", "image/png", "image/webp"];
// iOS Safari refuses canvases above ~16.7 megapixels.
const MAX_CANVAS_PIXELS = 16_000_000;

export function isHeic(f: File) {
  return /hei[cf]/i.test(f.type) || /\.(heic|heif)$/i.test(f.name);
}

export function looksLikeImage(f: File) {
  return f.type.startsWith("image/") || isHeic(f);
}

async function decode(file: File): Promise<{ img: CanvasImageSource; w: number; h: number; close(): void }> {
  if ("createImageBitmap" in window) {
    try {
      const b = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { img: b, w: b.width, h: b.height, close: () => b.close() };
    } catch {
      /* fall back to <img> (older Safari, some HEIC paths) */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return { img, w: img.naturalWidth, h: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}

function toBlob(canvas: HTMLCanvasElement, q: number) {
  return new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", q));
}

export async function prepare(file: File, quality: Quality, maxBytes: number): Promise<Blob> {
  const heic = isHeic(file);
  if (!quality.maxPx && !heic && PASS_THROUGH.includes(file.type) && file.size <= maxBytes) return file;

  const src = await decode(file);
  try {
    let scale = quality.maxPx ? Math.min(1, quality.maxPx / Math.max(src.w, src.h)) : 1;
    scale = Math.min(scale, Math.sqrt(MAX_CANVAS_PIXELS / (src.w * src.h)));
    // Already small enough and an accepted type: keep the original bytes.
    if (scale >= 1 && !heic && PASS_THROUGH.includes(file.type) && file.size <= maxBytes && quality.maxPx && file.size < 600_000) return file;
    const w = Math.max(1, Math.round(src.w * scale));
    const h = Math.max(1, Math.round(src.h * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas unavailable");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(src.img, 0, 0, w, h);
    let q = quality.jpeg / 100;
    for (;;) {
      const blob = await toBlob(canvas, q);
      if (!blob) throw new Error("could not encode photo");
      if (blob.size <= maxBytes || q <= 0.55) {
        canvas.width = canvas.height = 0; // frees memory on iOS
        if (blob.size > maxBytes) throw new Error("photo too large");
        return blob;
      }
      q -= 0.1;
    }
  } finally {
    src.close();
  }
}
