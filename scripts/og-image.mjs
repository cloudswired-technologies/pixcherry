// Social preview image (og:image, 1200x630) made from the real app screenshots in public/landing/v2,
// laid out like the landing hero and rendered with the site's fonts in Edge.
//   node scripts/og-image.mjs   -> public/og/pixcherry-og.jpg (keep it under ~300 KB for WhatsApp)
import { mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";
import sharp from "sharp";

const shot = (n) => pathToFileURL(resolve(`public/landing/v2/${n}.webp`)).href;
const icons = `<span class="icons">
  <svg viewBox="0 0 18 12" fill="currentColor"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg>
  <svg viewBox="0 0 16 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M1.5 4.3a9.5 9.5 0 0 1 13 0"/><path d="M4.2 7.1a5.7 5.7 0 0 1 7.6 0"/><path d="M6.9 9.9a1.8 1.8 0 0 1 2.2 0"/></svg>
  <svg viewBox="0 0 27 13"><rect x=".75" y=".75" width="22.5" height="11.5" rx="3.5" fill="none" stroke="currentColor" stroke-opacity=".45" stroke-width="1.5"/><rect x="2.5" y="2.5" width="19" height="8" rx="2" fill="currentColor"/><path d="M25 4.6v3.8a2 2 0 0 0 0-3.8z" fill="currentColor" fill-opacity=".45"/></svg>
</span>`;
const phone = (cls, img, tone, extra = "") =>
  `<div class="phone ${cls}"><div class="frame"><div class="screen"><div class="bar ${tone}"><span>9:41</span><span class="island"></span>${icons}</div><img src="${shot(img)}"></div></div>${extra}</div>`;

const html = `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Caveat:wght@600&family=Plus+Jakarta+Sans:wght@600;700;800&display=block" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0}
body{position:relative;width:1200px;height:630px;overflow:hidden;font-family:"Plus Jakarta Sans",sans-serif;color:#1f2937;
  background:radial-gradient(55% 70% at 88% 18%,rgba(233,29,72,.11),transparent 70%),radial-gradient(45% 60% at 0% 100%,#ffe6eb,transparent 70%),#fffafb}
.left{position:absolute;left:72px;top:62px;width:560px}
.logo{display:flex;align-items:center;gap:12px;font-weight:800;font-size:34px;letter-spacing:-.02em}
.logo svg{height:54px;width:auto}.logo b{color:#e91d48}
.kicker{margin-top:46px;display:flex;align-items:center;gap:10px;font-size:20px;font-weight:700;color:rgba(31,41,55,.72)}
.kicker i{width:10px;height:10px;border-radius:50%;background:#e91d48}
h1{margin-top:16px;font-size:58px;line-height:1.03;letter-spacing:-.035em;font-weight:800}
.sub{margin-top:22px;font-size:23px;line-height:1.45;color:#6b7280}
.url{position:absolute;left:72px;bottom:58px;background:#e91d48;color:#fff;font-weight:700;font-size:21px;padding:12px 24px;border-radius:999px;box-shadow:0 8px 24px rgba(233,29,72,.28)}
.stage{position:absolute;left:676px;top:150px;width:470px;height:520px;border-radius:44px;background:radial-gradient(90% 80% at 70% 10%,#ffd0da,#ffe6eb 55%,#fff4f6)}
.phone{position:absolute;container-type:inline-size;width:226px}
.frame{position:relative;border-radius:13cqw;background:#0e0f12;padding:2.2cqw;box-shadow:0 0 0 1.5px #3b4049,0 2px 6px rgba(31,41,55,.06),0 18px 40px rgba(31,41,55,.16)}
.screen{border-radius:10.8cqw;overflow:hidden;background:#f6eff1}
.bar{position:relative;height:11.5cqw;display:flex;align-items:center;justify-content:space-between;padding:0 8cqw;font-size:3.8cqw;font-weight:700}
.bar.light{background:#fefefe;color:#1f2937}.bar.dark{background:#0c0b0e;color:#fff}
.island{position:absolute;left:50%;top:2cqw;height:7.4cqw;width:26cqw;transform:translateX(-50%);border-radius:999px;background:#000}
.icons{display:flex;gap:1.3cqw;align-items:center}.icons svg{height:2.7cqw;width:auto}
.screen img{display:block;width:100%;aspect-ratio:390/844;object-fit:cover;object-position:top}
.a{left:668px;top:88px;transform:rotate(-4deg)}.b{left:922px;top:150px;transform:rotate(3deg)}
.live{position:absolute;right:-14px;top:17%;display:inline-flex;align-items:center;gap:6px;background:#fff;border-radius:999px;padding:6px 12px;font-size:14px;font-weight:800;box-shadow:0 8px 24px rgba(31,41,55,.14)}
.live i{width:8px;height:8px;border-radius:50%;background:#16a34a}
.arrow{position:absolute;left:840px;top:30px;width:150px;color:#e91d48}
.note{position:absolute;left:868px;top:-2px;font-family:Caveat;font-weight:600;font-size:34px;transform:rotate(-4deg)}
</style></head><body>
<div class="left">
  <div class="logo"><svg viewBox="0 0 120 104"><path d="M34 28H22a10 10 0 0 0-10 10v38a10 10 0 0 0 10 10h12" fill="none" stroke="#1f2937" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/><path d="M86 28h12a10 10 0 0 1 10 10v38a10 10 0 0 1-10 10H86" fill="none" stroke="#1f2937" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/><path d="M60 46c0-14 4-26 14-34" fill="none" stroke="#1f2937" stroke-width="5" stroke-linecap="round"/><path d="M72 14c6-10 18-14 30-12-3 12-13 20-26 20-3 0-4-4-4-8z" fill="#16a34a"/><circle cx="60" cy="64" r="24" fill="#e91d48"/><circle cx="69" cy="55" r="6" fill="#fff"/></svg><span>Pix<b>Cherry</b></span></div>
  <p class="kicker"><i></i>QR code photo sharing for weddings &amp; events</p>
  <h1>Every photo your guests take, in one live album.</h1>
  <p class="sub">Guests scan, snap and share. No app needed.</p>
</div>
<div class="url">pixcherry.com</div>
<div class="stage"></div>
${phone("a", "wedding-develop-gold", "dark")}
${phone("b", "wedding-b-after", "light", '<span class="live"><i></i>Live</span>')}
<svg class="arrow" viewBox="0 0 120 60"><path d="M6 50C30 0 90 0 114 58" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M116 46 114 58 104 51" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>
<p class="note">in seconds</p>
</body></html>`;

const tmp = join(tmpdir(), "pixcherry-og-image.html");
writeFileSync(tmp, html);
const b = await chromium.launch({ channel: "msedge" });
const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
await p.goto(pathToFileURL(tmp).href, { waitUntil: "networkidle" });
await p.evaluate(() => document.fonts.ready);
await p.waitForTimeout(300);
const png = await p.screenshot();
await b.close();
rmSync(tmp, { force: true });
mkdirSync("public/og", { recursive: true });
await sharp(png).jpeg({ quality: 86, mozjpeg: true }).toFile("public/og/pixcherry-og.jpg");
console.log(`public/og/pixcherry-og.jpg ${Math.round(statSync("public/og/pixcherry-og.jpg").size / 1024)} KB`);
