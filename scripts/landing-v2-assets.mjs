// Landing page assets from the promo project (D:\SYSTEM DEVELOPMENT\pixcherry-video): real-photo app
// screenshots → WebP, and the two promo videos → web-sized MP4s with posters.
//   node scripts/landing-v2-assets.mjs            (images + videos)
//   node scripts/landing-v2-assets.mjs --images   (images only; the video encode is slow)
import { execFileSync } from "node:child_process";
import { mkdirSync, statSync } from "node:fs";
import sharp from "sharp";

const SRC = "D:/SYSTEM DEVELOPMENT/pixcherry-video";
const OUT = "public/landing/v2";
const FFMPEG = `${SRC}/node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe`;
const imagesOnly = process.argv.includes("--images");
mkdirSync(OUT, { recursive: true });

const phone = ["wedding-home", "wedding-all", "wedding-b-after", "wedding-highlights", "wedding-viewer", "wedding-wishes", "wedding-develop-gold", "develop-polaroid", "join-sheet", "familyday-missions", "birthday-home", "convocation-home", "raya-home", "raya-after-share", "host-overview-phone", "host-photos-phone"];
const wide = ["slideshow-wedding", "slideshow-conference", "host-overview"];
for (const n of phone) await sharp(`${SRC}/public/shots/${n}.png`).resize({ width: 780 }).webp({ quality: 82 }).toFile(`${OUT}/${n}.webp`);
for (const n of wide) await sharp(`${SRC}/public/shots/${n}.png`).resize({ width: 1600 }).webp({ quality: 80 }).toFile(`${OUT}/${n}.webp`);
await sharp(`${SRC}/public/shots/qr-card.png`).resize({ width: 640 }).webp({ quality: 85 }).toFile(`${OUT}/qr-card.webp`);

const videos = imagesOnly
  ? []
  : [
      { src: "pixcherry-promo-16x9-loud.mp4", out: "promo-16x9", scale: "1280:720" },
      { src: "pixcherry-promo-9x16-v2-loud.mp4", out: "promo-9x16", scale: "720:1280" },
    ];
for (const v of videos) {
  const input = `${SRC}/out/${v.src}`;
  execFileSync(FFMPEG, ["-y", "-loglevel", "error", "-i", input, "-vf", `scale=${v.scale}`, "-c:v", "libx264", "-profile:v", "main", "-preset", "slow", "-crf", "27", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "112k", "-movflags", "+faststart", `${OUT}/${v.out}.mp4`]);
  execFileSync(FFMPEG, ["-y", "-loglevel", "error", "-ss", "2.5", "-i", input, "-frames:v", "1", "-vf", `scale=${v.scale}`, `${OUT}/${v.out}-poster.jpg`]);
  await sharp(`${OUT}/${v.out}-poster.jpg`).webp({ quality: 78 }).toFile(`${OUT}/${v.out}-poster.webp`);
  console.log(`${v.out}.mp4 ${(statSync(`${OUT}/${v.out}.mp4`).size / 1048576).toFixed(1)} MB`);
}
console.log("assets ready in", OUT);
