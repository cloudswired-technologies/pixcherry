"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronLeft, Loader2, RotateCcw } from "lucide-react";
import { LOOKS, createRenderer, drawOverlays, polaroid, type Renderer } from "@/lib/client/glfx";
import { playAdvance, unlockAudio } from "@/lib/client/camera-sounds";
import { TagPicker } from "./panels";

// "Develop" a photo from the phone's own camera: the native camera gives the
// best quality (full sensor, HDR, zoom), then the guest picks a film look,
// mission, hashtags and a caption here. The photo is sized down on the phone
// (high-quality resampling) before it's uploaded.

type Mission = { id: string; title: string; emoji: string | null };

/** Longest side of uploaded photos and their JPEG quality: sharp on any screen, quick on venue Wi-Fi. */
export const PHOTO_MAX_PX = 3072;
export const PHOTO_JPEG = 0.88;

async function loadPhoto(file: File) {
  const full = await createImageBitmap(file, { imageOrientation: "from-image" });
  const k = Math.min(1, PHOTO_MAX_PX / Math.max(full.width, full.height));
  if (k >= 1) return full;
  try {
    const small = await createImageBitmap(full, { resizeWidth: Math.round(full.width * k), resizeHeight: Math.round(full.height * k), resizeQuality: "high" });
    full.close();
    return small;
  } catch {
    return full; // drawn smaller later
  }
}

const toJpeg = (c: HTMLCanvasElement, q: number) => new Promise<Blob | null>((res) => c.toBlob(res, "image/jpeg", q));

export function Develop({
  file,
  onShare,
  onRetake,
  onClose,
  shotsLeft,
  missions,
  mission,
  onMission,
  suggestedTags,
  eventName,
  maxBytes,
}: {
  file: File;
  onShare: (photo: File, extra: { tags: string[]; caption: string }) => void;
  onRetake: () => void;
  onClose: () => void;
  shotsLeft: number;
  missions: Mission[];
  mission: string | null;
  onMission: (id: string | null) => void;
  suggestedTags: string[] | null;
  eventName: string;
  maxBytes: number;
}) {
  const view = useRef<HTMLCanvasElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const preview = useRef<Renderer | null>(null);
  const [img, setImg] = useState<ImageBitmap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lookIdx, setLookIdx] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [fit, setFit] = useState({ w: 0, h: 0 });
  const look = LOOKS[lookIdx];
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Phone back button closes this screen, not the album.
  useEffect(() => {
    history.pushState({ pcDevelop: true }, "");
    const pop = () => onCloseRef.current();
    window.addEventListener("popstate", pop);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("popstate", pop);
      document.body.style.overflow = overflow;
    };
  }, []);

  useEffect(() => {
    let live = true;
    let bmp: ImageBitmap | null = null;
    loadPhoto(file)
      .then((b) => {
        bmp = b;
        if (live) setImg(b);
        else b.close();
      })
      .catch(() => live && setError("This photo couldn't be opened. Try again."));
    return () => {
      live = false;
      bmp?.close();
    };
  }, [file]);

  // Fit the preview to the space available, keeping the photo's shape.
  useEffect(() => {
    const el = box.current;
    if (!el || !img) return;
    const measure = () => {
      const s = Math.min(el.clientWidth / img.width, el.clientHeight / img.height);
      setFit({ w: Math.floor(img.width * s), h: Math.floor(img.height * s) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [img]);

  // Live preview of the look (small canvas, so it's instant).
  useEffect(() => {
    const c = view.current;
    if (!c || !img || !fit.w) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = Math.round(fit.w * dpr);
    c.height = Math.round(fit.h * dpr);
    if (!preview.current) preview.current = createRenderer(c);
    const r = preview.current;
    if (r) r.draw(img, look, { mirror: false, time: 1 });
    else c.getContext("2d")?.drawImage(img, 0, 0, c.width, c.height);
  }, [img, look, fit]);

  useEffect(
    () => () => {
      preview.current?.dispose();
      preview.current = null;
    },
    [],
  );

  const share = async () => {
    if (!img || busy || shotsLeft <= 0) return;
    unlockAudio();
    setBusy(true);
    try {
      const out = document.createElement("canvas");
      out.width = img.width;
      out.height = img.height;
      const ctx = out.getContext("2d")!;
      const plain = look.id === "natural";
      if (plain) {
        // Natural: no shader at all, the photo exactly as the phone took it.
        ctx.drawImage(img, 0, 0);
      } else {
        const gc = document.createElement("canvas");
        const r = createRenderer(gc, true);
        let w = img.width;
        let h = img.height;
        if (r && Math.max(w, h) > r.maxSize) {
          const k = r.maxSize / Math.max(w, h);
          w = Math.round(w * k);
          h = Math.round(h * k);
        }
        gc.width = w;
        gc.height = h;
        if (r) {
          r.draw(img, look, { mirror: false, time: Math.random() * 100 });
          ctx.drawImage(gc, 0, 0, out.width, out.height);
          r.dispose();
        } else ctx.drawImage(img, 0, 0);
        gc.width = gc.height = 0;
        drawOverlays(ctx, out.width, out.height, look);
      }
      const final = look.polaroid ? polaroid(out, caption.trim() || eventName) : out;
      let q = PHOTO_JPEG;
      let blob: Blob | null = null;
      for (;;) {
        blob = await toJpeg(final, q);
        if (!blob || blob.size <= maxBytes || q <= 0.6) break;
        q -= 0.08;
      }
      out.width = out.height = 0;
      if (!blob) throw new Error("encode");
      playAdvance();
      navigator.vibrate?.([10, 30, 10]);
      onShare(new File([blob], `pixcherry-${Date.now()}.jpg`, { type: "image/jpeg" }), { tags, caption: caption.trim() });
    } catch {
      setError("Couldn't prepare this photo. Try again.");
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex select-none flex-col bg-[#0b0b0d] text-white" role="dialog" aria-modal="true" aria-label="Your photo">
      <div className="flex items-center justify-between gap-2 px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button type="button" onClick={() => history.back()} className="inline-flex h-10 items-center gap-1 rounded-full bg-white/12 pl-2 pr-4 text-sm font-semibold" aria-label="Back to album">
          <ChevronLeft className="size-5" aria-hidden /> Album
        </button>
        <div className="flex items-center gap-2 rounded-full bg-white/12 px-3 py-1.5" aria-live="polite">
          <span className="rounded bg-[#ff9d2e] px-1.5 font-mono text-sm font-bold tabular-nums text-black">{String(Math.max(0, shotsLeft)).padStart(2, "0")}</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-white/70">{shotsLeft === 1 ? "shot left" : "shots left"}</span>
        </div>
      </div>

      <div ref={box} className="relative grid min-h-0 flex-1 place-items-center px-3">
        {error ? (
          <p className="max-w-xs text-center text-sm text-white/80">{error}</p>
        ) : !img ? (
          <Loader2 className="size-8 animate-spin text-white/60" aria-label="Developing" />
        ) : (
          <div className={look.polaroid ? "bg-[#fbf8f1] p-[3%] pb-[14%] shadow-2xl" : ""}>
            <canvas ref={view} style={{ width: look.polaroid ? fit.w * 0.88 : fit.w, height: look.polaroid ? fit.h * 0.88 : fit.h }} className="block rounded-lg [animation:pc-develop_0.6s_ease]" aria-label="Photo preview" role="img" />
          </div>
        )}
      </div>

      <div className="grid gap-3 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4" aria-label="Looks">
          {LOOKS.map((x, i) => (
            <button key={x.id} type="button" onClick={() => setLookIdx(i)} className="grid w-14 shrink-0 snap-center justify-items-center gap-1" aria-pressed={i === lookIdx}>
              <span className={`size-11 rounded-full border-2 transition-transform ${i === lookIdx ? "scale-110 border-white" : "border-transparent"}`} style={{ background: x.swatch }} />
              <span className={`w-16 truncate text-center text-[10px] font-semibold ${i === lookIdx ? "text-white" : "text-white/55"}`}>{x.name}</span>
            </button>
          ))}
        </div>
        {missions.length ? (
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
            <button type="button" onClick={() => onMission(null)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${mission ? "bg-white/10" : "bg-white text-black"}`}>
              No mission
            </button>
            {missions.map((m) => (
              <button key={m.id} type="button" onClick={() => onMission(m.id)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${mission === m.id ? "bg-brand text-white" : "bg-white/10"}`}>
                {m.emoji ?? "🎯"} {m.title}
              </button>
            ))}
          </div>
        ) : null}
        {suggestedTags ? <TagPicker suggested={suggestedTags} value={tags} onChange={setTags} dark /> : null}
        <input
          value={caption}
          onChange={(e) => setCaption(e.target.value.slice(0, 140))}
          placeholder="Add a caption… (optional)"
          aria-label="Caption"
          enterKeyHint="done"
          className="h-11 rounded-full bg-white/10 px-4 text-sm text-white outline-none placeholder:text-white/50 focus:bg-white/15"
        />
        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={onRetake} disabled={busy} className="inline-flex h-13 items-center justify-center gap-2 rounded-full border border-white/25 py-3.5 font-semibold disabled:opacity-50">
            <RotateCcw className="size-5" aria-hidden /> Retake
          </button>
          <button type="button" onClick={share} disabled={!img || busy || shotsLeft <= 0} className="inline-flex h-13 items-center justify-center gap-2 rounded-full bg-brand py-3.5 font-semibold shadow-cherry disabled:opacity-50">
            {busy ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Check className="size-5" aria-hidden />} Share
          </button>
        </div>
        <p className="text-center text-xs text-white/50">Only shared photos use a shot.</p>
      </div>
    </div>
  );
}
