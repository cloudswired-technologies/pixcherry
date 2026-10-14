// Film filters for the in-app camera. Each filter is a list of CSS filter
// functions: the live preview uses the CSS string on the <video>, and the
// captured photo applies the same maths (Filter Effects spec colour matrices)
// to the pixels, so what you see is what you get on every browser — including
// iOS Safari, which has no canvas `ctx.filter`. Vignette and grain are drawn on top.

type Op =
  | ["brightness", number]
  | ["contrast", number]
  | ["saturate", number]
  | ["sepia", number]
  | ["grayscale", number]
  | ["hue", number]; // degrees

export type Filter = { id: string; name: string; ops: Op[]; vignette: number; grain: number };

export const FILTERS: Filter[] = [
  { id: "none", name: "Original", ops: [], vignette: 0, grain: 0 },
  { id: "film", name: "Film", ops: [["contrast", 1.08], ["saturate", 1.15], ["sepia", 0.12], ["brightness", 1.03]], vignette: 0.28, grain: 10 },
  { id: "golden", name: "Golden", ops: [["sepia", 0.25], ["saturate", 1.3], ["hue", -8], ["brightness", 1.05]], vignette: 0.2, grain: 6 },
  { id: "retro", name: "Retro", ops: [["sepia", 0.38], ["contrast", 0.95], ["saturate", 0.9], ["brightness", 1.06]], vignette: 0.38, grain: 14 },
  { id: "pop", name: "Pop", ops: [["saturate", 1.55], ["contrast", 1.1]], vignette: 0, grain: 0 },
  { id: "cool", name: "Cool", ops: [["hue", 12], ["saturate", 0.85], ["contrast", 0.96], ["brightness", 1.05]], vignette: 0.15, grain: 4 },
  { id: "fade", name: "Fade", ops: [["contrast", 0.82], ["brightness", 1.1], ["saturate", 0.78]], vignette: 0.12, grain: 8 },
  { id: "bw", name: "B&W", ops: [["grayscale", 1], ["contrast", 1.15]], vignette: 0.2, grain: 8 },
  { id: "noir", name: "Noir", ops: [["grayscale", 1], ["contrast", 1.45], ["brightness", 0.95]], vignette: 0.48, grain: 14 },
];

export function cssFilter(f: Filter) {
  if (!f.ops.length) return "none";
  return f.ops
    .map(([k, v]) => (k === "hue" ? `hue-rotate(${v}deg)` : `${k}(${v})`))
    .join(" ");
}

// 3x4 affine matrix [r g b offset] per output channel, offsets in 0..1.
type M = number[]; // length 12

const I: M = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];

function lin(a: number[]): M {
  return [a[0], a[1], a[2], 0, a[3], a[4], a[5], 0, a[6], a[7], a[8], 0];
}

function opMatrix([k, v]: Op): M {
  switch (k) {
    case "brightness":
      return [v, 0, 0, 0, 0, v, 0, 0, 0, 0, v, 0];
    case "contrast": {
      const o = 0.5 - 0.5 * v;
      return [v, 0, 0, o, 0, v, 0, o, 0, 0, v, o];
    }
    case "saturate":
      return lin([
        0.213 + 0.787 * v, 0.715 - 0.715 * v, 0.072 - 0.072 * v,
        0.213 - 0.213 * v, 0.715 + 0.285 * v, 0.072 - 0.072 * v,
        0.213 - 0.213 * v, 0.715 - 0.715 * v, 0.072 + 0.928 * v,
      ]);
    case "sepia": {
      const s = 1 - Math.min(1, v);
      return lin([
        0.393 + 0.607 * s, 0.769 - 0.769 * s, 0.189 - 0.189 * s,
        0.349 - 0.349 * s, 0.686 + 0.314 * s, 0.168 - 0.168 * s,
        0.272 - 0.272 * s, 0.534 - 0.534 * s, 0.131 + 0.869 * s,
      ]);
    }
    case "grayscale": {
      const s = 1 - Math.min(1, v);
      return lin([
        0.2126 + 0.7874 * s, 0.7152 - 0.7152 * s, 0.0722 - 0.0722 * s,
        0.2126 - 0.2126 * s, 0.7152 + 0.2848 * s, 0.0722 - 0.0722 * s,
        0.2126 - 0.2126 * s, 0.7152 - 0.7152 * s, 0.0722 + 0.9278 * s,
      ]);
    }
    case "hue": {
      const a = (v * Math.PI) / 180;
      const c = Math.cos(a);
      const s = Math.sin(a);
      return lin([
        0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928,
        0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.14, 0.072 - c * 0.072 - s * 0.283,
        0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072,
      ]);
    }
  }
}

/** b ∘ a: apply a first, then b. */
function compose(b: M, a: M): M {
  const out: M = new Array(12).fill(0);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) out[r * 4 + c] = b[r * 4] * a[c] + b[r * 4 + 1] * a[4 + c] + b[r * 4 + 2] * a[8 + c];
    out[r * 4 + 3] = b[r * 4] * a[3] + b[r * 4 + 1] * a[7] + b[r * 4 + 2] * a[11] + b[r * 4 + 3];
  }
  return out;
}

/** Applies the filter to a canvas in place (colour matrix, then vignette and grain). */
export function applyFilter(canvas: HTMLCanvasElement, f: Filter) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return;
  const { width: w, height: h } = canvas;
  if (f.ops.length || f.grain) {
    const m = f.ops.reduce((acc, op) => compose(opMatrix(op), acc), I);
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    const o0 = m[3] * 255, o1 = m[7] * 255, o2 = m[11] * 255;
    const g = f.grain;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], gr = d[i + 1], b = d[i + 2];
      const n = g ? (Math.random() - 0.5) * g * 2 : 0;
      d[i] = m[0] * r + m[1] * gr + m[2] * b + o0 + n; // Uint8ClampedArray clamps
      d[i + 1] = m[4] * r + m[5] * gr + m[6] * b + o1 + n;
      d[i + 2] = m[8] * r + m[9] * gr + m[10] * b + o2 + n;
    }
    ctx.putImageData(img, 0, 0);
  }
  if (f.vignette) {
    const grad = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) / 2);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, `rgba(0,0,0,${f.vignette})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }
}

/** CSS for the preview vignette overlay. */
export function vignetteCss(f: Filter) {
  return f.vignette ? `radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, rgba(0,0,0,${f.vignette}) 100%)` : "none";
}
