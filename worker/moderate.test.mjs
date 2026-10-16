// Quick check of the AI step: node worker/moderate.test.mjs
// A plain photo must pass; with WORKER_NSFW_HIDE=0 the same photo must be hidden.
import sharp from "sharp";
import { moderate } from "./moderate.mjs";

const img = await sharp({ create: { width: 640, height: 480, channels: 3, background: "#7fb3d5" } })
  .composite([{ input: Buffer.from('<svg width="640" height="480"><circle cx="320" cy="240" r="120" fill="#2e7d32"/></svg>') }])
  .webp()
  .toBuffer();
const t = Date.now();
const first = await moderate(img);
const t2 = Date.now();
const second = await moderate(img);
console.log(JSON.stringify({ first, loadAndClassifyMs: t2 - t, second, classifyMs: Date.now() - t2, hide: process.env.WORKER_NSFW_HIDE ?? "default" }));
const expectHidden = process.env.WORKER_NSFW_HIDE === "0";
const ok = first && (expectHidden ? first.flag === "ai" : first.flag !== "ai");
console.log(ok ? "PASS" : "FAIL");
process.exit(ok ? 0 : 1);
