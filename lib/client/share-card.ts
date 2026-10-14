// Story-sized share card (1080x1920) drawn in the guest's browser:
// up to three of their own photos as polaroids, the event name and a count.
// It never contains the album link or QR — albums are private links.

const W = 1080;
const H = 1920;

function cssFont(varName: string, fallback: string) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return v || fallback;
}

async function loadPhoto(url: string) {
  const r = await fetch(url); // same-origin download route: no canvas tainting
  if (!r.ok) throw new Error("photo");
  return createImageBitmap(await r.blob());
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function cover(ctx: CanvasRenderingContext2D, img: ImageBitmap, x: number, y: number, w: number, h: number) {
  const s = Math.max(w / img.width, h / img.height);
  const sw = w / s;
  const sh = h / s;
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const t = line ? `${line} ${w}` : w;
    if (ctx.measureText(t).width > maxW && line) {
      lines.push(line);
      line = w;
    } else line = t;
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

export async function makeShareCard(opts: { eventName: string; date: string; count: number; photoUrls: string[]; accent: string; guestName: string | null }) {
  await document.fonts?.ready;
  const sans = cssFont("--font-jakarta", "system-ui");
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;

  // background
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, opts.accent);
  g.addColorStop(1, "#ff8aa1");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(W - 120, 260, 300, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(80, H - 260, 260, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // header
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.font = `700 46px ${sans}`;
  ctx.fillText("📸  " + (opts.guestName ? `${opts.guestName} shared` : "I shared"), W / 2, 200);
  ctx.font = `800 150px ${sans}`;
  ctx.fillText(`${opts.count} photo${opts.count === 1 ? "" : "s"}`, W / 2, 360);
  // Same typeface as the lines above: one style per sentence.
  ctx.font = `700 54px ${sans}`;
  const lines = wrap(ctx, `at ${opts.eventName}`, W - 160);
  lines.forEach((l, i) => ctx.fillText(l, W / 2, 460 + i * 66));

  // polaroids
  const photos = (await Promise.all(opts.photoUrls.slice(0, 3).map((u) => loadPhoto(u).catch(() => null)))).filter((x): x is ImageBitmap => !!x);
  const spots = [
    { x: W / 2, y: 1120, r: -0.06, s: 1 },
    { x: W / 2 - 250, y: 1000, r: -0.16, s: 0.78 },
    { x: W / 2 + 250, y: 1020, r: 0.14, s: 0.78 },
  ];
  // [spot, photo]: back two first, the front one last.
  const plan = photos.length >= 3 ? [[1, 1], [2, 2], [0, 0]] : photos.length === 2 ? [[1, 1], [0, 0]] : photos.length ? [[0, 0]] : [];
  for (const [si, pi] of plan) {
    const sp = spots[si];
    const img = photos[pi];
    const pw = 560 * sp.s;
    const ph = 640 * sp.s;
    ctx.save();
    ctx.translate(sp.x, sp.y);
    ctx.rotate(sp.r);
    ctx.shadowColor = "rgba(0,0,0,0.25)";
    ctx.shadowBlur = 40;
    ctx.shadowOffsetY = 18;
    ctx.fillStyle = "#fbf8f1";
    ctx.fillRect(-pw / 2, -ph / 2, pw, ph);
    ctx.shadowColor = "transparent";
    const m = 28 * sp.s;
    cover(ctx, img, -pw / 2 + m, -ph / 2 + m, pw - m * 2, pw - m * 2);
    ctx.restore();
  }

  // date pill
  ctx.font = `700 40px ${sans}`;
  const dateW = ctx.measureText(opts.date).width + 80;
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  roundRect(ctx, (W - dateW) / 2, 1530, dateW, 84, 42);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.fillText(opts.date, W / 2, 1586);

  // footer brand (no album link: the album is private)
  ctx.font = `800 54px ${sans}`;
  ctx.fillText("PixCherry", W / 2, 1760);
  ctx.font = `600 32px ${sans}`;
  ctx.globalAlpha = 0.85;
  ctx.fillText("Share your best moment · pixcherry.com", W / 2, 1812);
  ctx.globalAlpha = 1;

  photos.forEach((p) => p.close());
  return new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("card"))), "image/jpeg", 0.9));
}
