// AI check for nudity (NSFWJS MobileNetV2 on the TensorFlow.js WASM backend).
// Measured on the 1 vCPU server: ~65 ms per photo, ~100 MB extra RAM.
// Never blocks an upload: if the model can't load or classify, the photo goes
// through as usual and we try loading again a few minutes later.
//
//   WORKER_MODERATION=off     switch the check off
//   WORKER_NSFW_HIDE=0.7      porn+hentai score that hides a photo for the host
//   WORKER_NSFW_SOFT=0.4      porn+hentai score that only marks it ("AI: check")
//   WORKER_SEXY_SOFT=0.85     "sexy" score that only marks it
import sharp from "sharp";

const OFF = process.env.WORKER_MODERATION === "off";
const HIDE = Number(process.env.WORKER_NSFW_HIDE ?? 0.7);
const SOFT = Number(process.env.WORKER_NSFW_SOFT ?? 0.4);
const SEXY = Number(process.env.WORKER_SEXY_SOFT ?? 0.85);
const SIZE = 224;
const RETRY_MS = 5 * 60_000;

let loading = null;
let failedAt = 0;

async function load() {
  const tf = await import("@tensorflow/tfjs");
  await import("@tensorflow/tfjs-backend-wasm");
  await tf.setBackend("wasm");
  await tf.ready();
  const nsfwjs = await import("nsfwjs");
  const model = await nsfwjs.load("MobileNetV2");
  return { tf, model };
}

function model() {
  if (OFF) return null;
  if (!loading) {
    if (Date.now() - failedAt < RETRY_MS) return null;
    const t = Date.now();
    loading = load().then(
      (m) => {
        console.log(`moderation: model ready in ${Date.now() - t}ms`);
        return m;
      },
      (err) => {
        console.error("moderation: model failed to load:", err.message);
        failedAt = Date.now();
        loading = null;
        return null;
      },
    );
  }
  return loading;
}

/**
 * Score a photo (any image buffer; the small preview is enough).
 * Returns { flag: 'ai' | 'ai_soft' | null, nsfw } or null when the check is unavailable.
 */
export async function moderate(buf) {
  const m = await model();
  if (!m) return null;
  try {
    const raw = await sharp(buf).resize(SIZE, SIZE, { fit: "fill" }).removeAlpha().raw().toBuffer();
    const img = m.tf.tensor3d(new Uint8Array(raw), [SIZE, SIZE, 3], "int32");
    let preds;
    try {
      preds = await m.model.classify(img);
    } finally {
      img.dispose();
    }
    const p = Object.fromEntries(preds.map((x) => [x.className, x.probability]));
    const nsfw = Math.round(((p.Porn ?? 0) + (p.Hentai ?? 0)) * 1000) / 1000;
    const flag = nsfw >= HIDE ? "ai" : nsfw >= SOFT || (p.Sexy ?? 0) >= SEXY ? "ai_soft" : null;
    return { flag, nsfw };
  } catch (err) {
    console.error("moderation: classify failed:", err.message);
    return null;
  }
}

/** Load the model at start-up so the first photo isn't slow. */
export function warmUp() {
  void model();
}
