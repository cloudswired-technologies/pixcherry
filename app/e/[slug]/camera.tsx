"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, RefreshCw, RotateCcw, Zap, ZapOff } from "lucide-react";
import { LOOKS, createRenderer, drawOverlays, polaroid, stampText, type Look, type Renderer } from "@/lib/client/glfx";
import { playAdvance, playShutter, unlockAudio } from "@/lib/client/camera-sounds";
import { stillPhoto } from "@/lib/client/still";
import { PHOTO_JPEG, PHOTO_MAX_PX } from "./develop";
import { CaptionOverlay, ShotExtras } from "./shot-extras";

// PixCherry camera: a live viewfinder with the film look, shutter sound and
// animation, shots-left counter — and the photo itself taken as a real still
// from the camera sensor where the phone allows it (Android Chrome), not a
// video frame. Pinch or tap 1×/2× to zoom (the camera's own zoom when it has
// one), tap to focus, flash for the back camera. Review before sharing: look,
// mission, hashtags, caption.

type Mission = { id: string; title: string; emoji: string | null };
type Shot = { file: File; url: string; mp: number; source: "photo" | "frame" };
type Zoom = { min: number; max: number; step: number; hw: boolean };
type MediaCaps = MediaTrackCapabilities & { zoom?: { min: number; max: number; step?: number }; torch?: boolean; focusMode?: string[] };

const MAX_CANVAS_PIXELS = 16_000_000;
const DIGITAL_MAX = 4;

export function PixCamera({
  onClose,
  onShot,
  onFallback,
  shotsLeft,
  maxBytes,
  missions,
  mission,
  onMission,
  suggestedTags,
  eventName,
}: {
  onClose: () => void;
  onShot: (file: File, extra: { tags: string[]; caption: string }) => void;
  /** Camera blocked or unsupported: use the phone's own camera app instead. */
  onFallback: () => void;
  shotsLeft: number;
  maxBytes: number;
  missions: Mission[];
  mission: string | null;
  onMission: (id: string | null) => void;
  suggestedTags: string[] | null;
  eventName: string;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const view = useRef<HTMLCanvasElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const renderer = useRef<Renderer | null>(null);
  const track = useRef<MediaStreamTrack | null>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [gl, setGl] = useState(true);
  const [lookIdx, setLookIdx] = useState(0);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [shutter, setShutter] = useState(0);
  const [review, setReview] = useState<Shot | null>(null);
  const [busy, setBusy] = useState(false);
  const [roll, setRoll] = useState<string[]>([]);
  const [rollAt, setRollAt] = useState<number | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [caption, setCaption] = useState("");
  const [zoomCaps, setZoomCaps] = useState<Zoom>({ min: 1, max: DIGITAL_MAX, step: 0.1, hw: false });
  const [zoom, setZoom] = useState(1);
  const [torch, setTorch] = useState<{ can: boolean; on: boolean }>({ can: false, on: false });
  const [focus, setFocus] = useState<{ x: number; y: number; k: number } | null>(null);
  const look = LOOKS[lookIdx];
  const lookRef = useRef<Look>(look);
  const zoomRef = useRef(1);
  const rollOpen = useRef(false);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    lookRef.current = look;
    zoomRef.current = zoom;
    rollOpen.current = rollAt !== null;
    onCloseRef.current = onClose;
  });

  // Back button closes the roll first, then the camera — never the album.
  useEffect(() => {
    history.pushState({ pcCamera: true }, "");
    const pop = () => (rollOpen.current ? setRollAt(null) : onCloseRef.current());
    window.addEventListener("popstate", pop);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("popstate", pop);
      document.body.style.overflow = overflow;
    };
  }, []);

  const rollUrls = useRef<string[]>([]);
  useEffect(() => {
    rollUrls.current = roll;
  }, [roll]);
  useEffect(() => () => rollUrls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  // Camera stream, its zoom range and flash.
  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("unsupported");
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facing }, width: { ideal: 2560 }, height: { ideal: 1920 } }, audio: false });
        if (cancelled) return stream.getTracks().forEach((t) => t.stop());
        const t = stream.getVideoTracks()[0] ?? null;
        track.current = t;
        const caps = (t?.getCapabilities?.() ?? {}) as MediaCaps;
        if (caps.zoom && caps.zoom.max > caps.zoom.min) setZoomCaps({ min: caps.zoom.min, max: Math.min(caps.zoom.max, 10), step: caps.zoom.step ?? 0.1, hw: true });
        else setZoomCaps({ min: 1, max: DIGITAL_MAX, step: 0.1, hw: false });
        setZoom(caps.zoom?.min ?? 1);
        setTorch({ can: !!caps.torch, on: false });
        const v = video.current!;
        v.srcObject = stream;
        await v.play().catch(() => {});
        setReady(true);
      } catch (e) {
        const name = (e as { name?: string }).name;
        setError(name === "NotAllowedError" ? "Camera access is blocked. Allow the camera for this site, or use your phone's camera instead." : "This browser can't open the camera here. Use your phone's camera instead.");
      }
    })();
    return () => {
      cancelled = true;
      track.current = null;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [facing]);

  // Optical/hardware zoom follows the slider; digital zoom is applied when drawing.
  const applyZoom = useCallback(
    (z: number) => {
      const c = Math.min(zoomCaps.max, Math.max(zoomCaps.min, z));
      setZoom(c);
      if (zoomCaps.hw) track.current?.applyConstraints({ advanced: [{ zoom: c } as MediaTrackConstraintSet] }).catch(() => {});
    },
    [zoomCaps],
  );

  // Fit the viewfinder to the camera's aspect ratio.
  useEffect(() => {
    const el = stage.current;
    const v = video.current;
    if (!el || !v) return;
    const fit = () => {
      const vw = v.videoWidth || 3;
      const vh = v.videoHeight || 4;
      const frame = look.polaroid ? { x: 1.12, y: 1.28 } : { x: 1, y: 1 };
      const s = Math.min(el.clientWidth / frame.x / vw, el.clientHeight / frame.y / vh);
      setBox({ w: Math.floor(vw * s), h: Math.floor(vh * s) });
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    v.addEventListener("loadedmetadata", fit);
    return () => {
      ro.disconnect();
      v.removeEventListener("loadedmetadata", fit);
    };
  }, [ready, look.polaroid]);

  // GPU preview loop.
  useEffect(() => {
    const c = view.current;
    const v = video.current;
    if (!c || !v || !ready || !box.w) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = Math.round(box.w * dpr);
    c.height = Math.round(box.h * dpr);
    if (!renderer.current) renderer.current = createRenderer(c);
    if (!renderer.current) {
      setGl(false);
      return;
    }
    let raf = 0;
    const loop = (t: number) => {
      if (v.readyState >= 2) renderer.current!.draw(v, lookRef.current, { mirror: facing === "user", time: (t / 1000) % 100 });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [ready, box.w, box.h, facing]);
  useEffect(
    () => () => {
      renderer.current?.dispose();
      renderer.current = null;
    },
    [],
  );

  // Pinch to zoom, tap to focus.
  const pts = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d: number; z: number } | null>(null);
  const tapStart = useRef<{ x: number; y: number; t: number } | null>(null);
  const onDown = (e: React.PointerEvent) => {
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.current.size === 2) {
      const [a, b] = [...pts.current.values()];
      pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), z: zoomRef.current };
      tapStart.current = null;
    } else tapStart.current = { x: e.clientX, y: e.clientY, t: Date.now() };
  };
  const onMove = (e: React.PointerEvent) => {
    if (!pts.current.has(e.pointerId)) return;
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.current && pts.current.size >= 2) {
      const [a, b] = [...pts.current.values()];
      applyZoom(pinch.current.z * (Math.hypot(a.x - b.x, a.y - b.y) / pinch.current.d));
    }
  };
  const onUp = (e: React.PointerEvent) => {
    pts.current.delete(e.pointerId);
    if (pts.current.size < 2) pinch.current = null;
    const t = tapStart.current;
    tapStart.current = null;
    if (!t || Date.now() - t.t > 400 || Math.hypot(e.clientX - t.x, e.clientY - t.y) > 12) return;
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    setFocus({ x: e.clientX - r.left, y: e.clientY - r.top, k: Date.now() });
    const caps = (track.current?.getCapabilities?.() ?? {}) as MediaCaps;
    const modes = caps.focusMode ?? [];
    const mode = modes.includes("single-shot") ? "single-shot" : modes.includes("continuous") ? "continuous" : null;
    if (mode) track.current?.applyConstraints({ advanced: [{ pointsOfInterest: [{ x, y }], focusMode: mode } as MediaTrackConstraintSet] }).catch(() => {});
  };

  const toggleTorch = () => {
    const on = !torch.on;
    setTorch({ ...torch, on });
    track.current?.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] }).catch(() => setTorch({ can: false, on: false }));
  };

  const snap = useCallback(async () => {
    const v = video.current;
    if (!v || !ready || busy || shotsLeft <= 0 || !v.videoWidth) return;
    unlockAudio();
    playShutter();
    navigator.vibrate?.(30);
    setShutter((s) => s + 1);
    stage.current?.animate([{ transform: "translate(0,0)" }, { transform: "translate(-3px,2px)" }, { transform: "translate(3px,-2px)" }, { transform: "translate(0,0)" }], { duration: 220, easing: "ease-out" });
    setBusy(true);
    let still: ImageBitmap | null = null;
    try {
      const digital = zoomCaps.hw ? 1 : zoomRef.current;
      // A real photo from the sensor where possible; otherwise this video frame.
      still = await stillPhoto(track.current, PHOTO_MAX_PX, digital);
      const l = lookRef.current;
      let src: TexImageSource;
      let sx = 0;
      let sy = 0;
      let sw: number;
      let sh: number;
      if (still) {
        src = still;
        sw = still.width;
        sh = still.height;
      } else {
        src = v;
        sw = Math.round(v.videoWidth / digital);
        sh = Math.round(v.videoHeight / digital);
        sx = Math.round((v.videoWidth - sw) / 2);
        sy = Math.round((v.videoHeight - sh) / 2);
      }
      const k = Math.min(1, PHOTO_MAX_PX / Math.max(sw, sh), Math.sqrt(MAX_CANVAS_PIXELS / (sw * sh)));
      const w = Math.round(sw * k);
      const h = Math.round(sh * k);
      const out = document.createElement("canvas");
      out.width = w;
      out.height = h;
      const ctx = out.getContext("2d")!;
      ctx.imageSmoothingQuality = "high";
      const mirror = facing === "user";
      if (l.id === "natural" || !gl) {
        // Natural: no shader, the photo as the camera took it.
        if (mirror) {
          ctx.translate(w, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(src as CanvasImageSource, sx, sy, sw, sh, 0, 0, w, h);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
      } else {
        // Film look: the same shader as the viewfinder, on the full-size photo.
        const pre = document.createElement("canvas");
        pre.width = w;
        pre.height = h;
        const pctx = pre.getContext("2d")!;
        pctx.imageSmoothingQuality = "high";
        pctx.drawImage(src as CanvasImageSource, sx, sy, sw, sh, 0, 0, w, h);
        const gc = document.createElement("canvas");
        const r = createRenderer(gc, true);
        if (r) {
          const m = Math.min(1, r.maxSize / Math.max(w, h));
          gc.width = Math.round(w * m);
          gc.height = Math.round(h * m);
          r.draw(pre, l, { mirror, time: Math.random() * 100 });
          ctx.drawImage(gc, 0, 0, w, h);
          r.dispose();
        } else ctx.drawImage(pre, 0, 0);
        pre.width = pre.height = gc.width = gc.height = 0;
        drawOverlays(ctx, w, h, l);
      }
      const final = l.polaroid ? polaroid(out, eventName) : out;
      let q = PHOTO_JPEG;
      let blob: Blob | null = null;
      for (;;) {
        blob = await new Promise<Blob | null>((res) => final.toBlob(res, "image/jpeg", q));
        if (!blob || blob.size <= maxBytes || q <= 0.6) break;
        q -= 0.08;
      }
      out.width = out.height = 0;
      if (blob) {
        const file = new File([blob], `pixcherry-${Date.now()}.jpg`, { type: "image/jpeg" });
        const mp = Math.round(((still ? still.width * still.height : sw * sh) / 1e6) * 10) / 10;
        setTimeout(() => setReview({ file, url: URL.createObjectURL(file), mp, source: still ? "photo" : "frame" }), 120);
      }
    } finally {
      still?.close();
      setTimeout(() => setBusy(false), 200);
    }
  }, [ready, busy, shotsLeft, facing, gl, maxBytes, eventName, zoomCaps.hw]);

  const share = () => {
    if (!review) return;
    playAdvance();
    navigator.vibrate?.([10, 30, 10, 30, 10]);
    onShot(review.file, { tags, caption: caption.trim() });
    setRoll((r) => [...r, review.url]);
    setReview(null);
    setCaption("");
  };
  const retake = () => {
    if (review) URL.revokeObjectURL(review.url);
    setReview(null);
  };

  const empty = shotsLeft <= 0;
  const last = roll.at(-1) ?? null;
  const digitalScale = zoomCaps.hw ? 1 : zoom;
  const stampSize = Math.max(10, Math.round(Math.min(box.w, box.h) * (look.stamp === "vhs" ? 0.04 : 0.055)));
  const presets = [zoomCaps.min, ...[2, 5].filter((z) => z > zoomCaps.min && z <= zoomCaps.max)];

  return (
    <div className="fixed inset-0 z-[60] flex select-none flex-col bg-[#0b0b0d] text-white" role="dialog" aria-modal="true" aria-label="Camera">
      <div className="flex items-center justify-between gap-2 px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button type="button" onClick={() => history.back()} className="inline-flex h-10 items-center gap-1 rounded-full bg-white/12 pl-2 pr-4 text-sm font-semibold backdrop-blur" aria-label="Back to album">
          <ChevronLeft className="size-5" aria-hidden /> Album
        </button>
        <div className="flex items-center gap-2 rounded-full bg-white/12 px-3 py-1.5" aria-live="polite">
          <span className="rounded bg-[#ff9d2e] px-1.5 font-mono text-sm font-bold tabular-nums text-black">{String(Math.max(0, shotsLeft)).padStart(2, "0")}</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-white/70">{shotsLeft === 1 ? "shot left" : "shots left"}</span>
        </div>
        <div className="flex gap-1.5">
          {torch.can && facing === "environment" ? (
            <button type="button" onClick={toggleTorch} className={`grid size-10 place-items-center rounded-full ${torch.on ? "bg-[#ffd166] text-black" : "bg-white/12"}`} aria-label={torch.on ? "Flash off" : "Flash on"} aria-pressed={torch.on}>
              {torch.on ? <Zap className="size-5" aria-hidden /> : <ZapOff className="size-5" aria-hidden />}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              setReady(false);
              setError(null);
              setFacing((x) => (x === "user" ? "environment" : "user"));
            }}
            className="grid size-10 place-items-center rounded-full bg-white/12"
            aria-label="Switch camera"
          >
            <RefreshCw className="size-5" aria-hidden />
          </button>
        </div>
      </div>

      {missions.length && !review ? (
        <div className="no-scrollbar flex gap-2 overflow-x-auto px-3 pb-2">
          <button type="button" onClick={() => onMission(null)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${mission ? "bg-white/10" : "bg-white text-black"}`}>
            Free shot
          </button>
          {missions.map((m) => (
            <button key={m.id} type="button" onClick={() => onMission(m.id)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${mission === m.id ? "bg-brand text-white" : "bg-white/10"}`}>
              {m.emoji ?? "🎯"} {m.title}
            </button>
          ))}
        </div>
      ) : null}

      {/* viewfinder */}
      <div ref={stage} className="relative grid min-h-0 flex-1 place-items-center overflow-hidden">
        <video ref={video} playsInline muted autoPlay className={gl ? "pointer-events-none absolute size-px opacity-0" : "absolute inset-0 size-full object-contain"} style={!gl && facing === "user" ? { transform: "scaleX(-1)" } : undefined} />
        {error ? (
          <div className="grid max-w-xs gap-4 px-6 text-center">
            <p className="text-sm text-white/80">{error}</p>
            <button type="button" onClick={onFallback} className="mx-auto inline-flex h-12 items-center gap-2 rounded-full bg-brand px-6 font-semibold text-white">
              Use phone camera
            </button>
          </div>
        ) : (
          <div
            className="relative touch-none overflow-hidden"
            style={look.polaroid ? { padding: `${box.w * 0.06}px ${box.w * 0.06}px ${box.w * 0.22}px`, background: "#fbf8f1", borderRadius: 6 } : { borderRadius: 14 }}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            aria-label="Viewfinder: pinch to zoom, tap to focus"
          >
            <div className="relative overflow-hidden" style={{ width: box.w, height: box.h, borderRadius: look.polaroid ? 0 : 14 }}>
              {gl ? <canvas ref={view} className="block size-full origin-center" style={{ transform: `scale(${digitalScale})` }} /> : null}
              {look.bars ? (
                <>
                  <div className="absolute inset-x-0 top-0 bg-black" style={{ height: "9%" }} />
                  <div className="absolute inset-x-0 bottom-0 bg-black" style={{ height: "9%" }} />
                </>
              ) : null}
              {look.stamp ? (
                <div
                  className="absolute font-mono font-bold"
                  style={
                    look.stamp === "vhs"
                      ? { left: stampSize * 1.2, bottom: stampSize * 0.6, fontSize: stampSize, color: "rgba(255,255,255,.92)", textShadow: "0 0 4px rgba(0,0,0,.6)" }
                      : { right: stampSize * 1.1, bottom: stampSize * 0.4, fontSize: stampSize, color: "#ff9d2e", textShadow: "0 0 8px rgba(255,120,20,.9)" }
                  }
                >
                  {stampText(look.stamp)}
                </div>
              ) : null}
              {focus ? <span key={focus.k} className="pointer-events-none absolute size-16 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#ffd166] [animation:pc-pop_0.9s_ease_forwards]" style={{ left: focus.x, top: focus.y }} aria-hidden /> : null}
              {!ready ? <div className="absolute inset-0 grid place-items-center text-sm text-white/60">Opening camera…</div> : null}
              {empty ? (
                <div className="absolute inset-0 grid place-items-center bg-black/70 px-8 text-center">
                  <div>
                    <div className="text-4xl">🎞️</div>
                    <p className="mt-2 text-lg font-bold">That&apos;s the whole roll!</p>
                    <p className="text-sm text-white/70">Thanks for capturing the moments.</p>
                  </div>
                </div>
              ) : null}
            </div>
            {look.polaroid ? (
              <div className="absolute inset-x-0 bottom-0 grid place-items-center font-script font-bold text-[#2b2622]" style={{ height: box.w * 0.22, fontSize: box.w * 0.06 }}>
                {eventName.slice(0, 40)}
              </div>
            ) : null}
            {ready && !review ? (
              <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
                {presets.map((z) => (
                  <button
                    key={z}
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => applyZoom(z)}
                    className={`grid h-8 min-w-8 place-items-center rounded-full px-2 text-xs font-bold backdrop-blur ${Math.abs(zoom - z) < 0.15 ? "bg-white text-black" : "bg-black/45 text-white"}`}
                    aria-label={`Zoom ${z}×`}
                  >
                    {Math.abs(zoom - z) < 0.15 ? `${Math.round(z * 10) / 10}×` : `${z}`}
                  </button>
                ))}
                {!presets.some((z) => Math.abs(zoom - z) < 0.15) ? <span className="grid h-8 place-items-center rounded-full bg-white px-2 text-xs font-bold text-black">{zoom.toFixed(1)}×</span> : null}
              </div>
            ) : null}
          </div>
        )}
        {review ? (
          <div className="absolute inset-0 grid place-items-center bg-[#0b0b0d] px-4">
            <div className="relative max-h-full">
              <img src={review.url} alt="Your photo" className="max-h-[inherit] max-w-full rounded-xl shadow-2xl [animation:pc-develop_0.6s_ease]" style={{ maxHeight: "calc(100dvh - 17rem)" }} />
              <CaptionOverlay caption={caption} />
            </div>
            <span className="absolute left-5 top-3 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-semibold text-white/85">
              {review.mp} MP · {review.source === "photo" ? "camera photo" : "video frame"}
            </span>
          </div>
        ) : null}
        {shutter ? (
          <div key={shutter} className="pointer-events-none absolute inset-0">
            <div className="absolute inset-x-0 top-0 h-1/2 origin-top scale-y-0 bg-black [animation:pc-curtain_0.26s_ease_forwards]" />
            <div className="absolute inset-x-0 bottom-0 h-1/2 origin-bottom scale-y-0 bg-black [animation:pc-curtain_0.26s_ease_forwards]" />
            <div className="absolute inset-0 bg-white [animation:pc-flash_0.35s_ease_forwards]" />
          </div>
        ) : null}
      </div>

      {rollAt !== null && roll[rollAt] ? <RollViewer urls={roll} index={rollAt} onIndex={setRollAt} onClose={() => history.back()} /> : null}

      {review ? (
        <div className="grid gap-3 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3">
          <ShotExtras missions={missions} mission={mission} onMission={onMission} suggestedTags={suggestedTags} tags={tags} onTags={setTags} caption={caption} onCaption={setCaption} />
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={retake} className="inline-flex h-14 items-center justify-center gap-2 rounded-full border border-white/25 font-semibold">
              <RotateCcw className="size-5" aria-hidden /> Retake
            </button>
            <button type="button" onClick={share} className="inline-flex h-14 items-center justify-center gap-2 rounded-full bg-brand font-semibold shadow-cherry">
              <Check className="size-5" aria-hidden /> Share
            </button>
          </div>
          <p className="text-center text-xs text-white/50">Only shared photos use a shot.</p>
        </div>
      ) : !error ? (
        <div className="pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
          <div className="no-scrollbar flex snap-x gap-3 overflow-x-auto px-[calc(50%-1.75rem)] pb-4" aria-label="Looks">
            {LOOKS.map((x, i) => (
              <button
                key={x.id}
                type="button"
                onClick={(ev) => {
                  setLookIdx(i);
                  ev.currentTarget.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
                }}
                className="grid w-14 shrink-0 snap-center justify-items-center gap-1"
                aria-pressed={i === lookIdx}
              >
                <span className={`size-12 rounded-full border-2 transition-transform ${i === lookIdx ? "scale-110 border-white" : "border-transparent"}`} style={{ background: x.swatch }} />
                <span className={`w-16 truncate text-center text-[10px] font-semibold ${i === lookIdx ? "text-white" : "text-white/55"}`}>{x.name}</span>
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between px-8">
            <button
              type="button"
              onClick={() => {
                if (!last) return;
                history.pushState({ pcRoll: true }, "");
                setRollAt(roll.length - 1);
              }}
              disabled={!last}
              aria-label="Open your shots"
              className="relative size-14 overflow-hidden rounded-xl border-2 border-white/40 bg-white/10"
            >
              {last ? <img key={last} src={last} alt="Last shot" className="size-full object-cover [animation:pc-fly_0.5s_ease]" /> : null}
              {roll.length > 1 ? <span className="absolute right-0.5 top-0.5 rounded-full bg-black/60 px-1.5 text-[10px] font-bold">{roll.length}</span> : null}
            </button>
            <button type="button" onClick={snap} disabled={!ready || busy || empty} aria-label="Take photo" className="grid size-20 place-items-center rounded-full border-4 border-white transition-transform active:scale-90 disabled:opacity-40">
              <span className="size-[3.9rem] rounded-full bg-brand" />
            </button>
            <div className="size-14 text-center text-[10px] leading-tight text-white/60">
              <span className="block text-base">🎞️</span>
              {look.name}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** This session's shared shots, like tapping the thumbnail on a phone camera. */
function RollViewer({ urls, index, onIndex, onClose }: { urls: string[]; index: number; onIndex: (i: number) => void; onClose: () => void }) {
  const start = useRef<number | null>(null);
  const go = (i: number) => i >= 0 && i < urls.length && onIndex(i);
  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-[#0b0b0d]" role="dialog" aria-label="Your shots">
      <div className="flex items-center justify-between gap-2 px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button type="button" onClick={onClose} className="inline-flex h-10 items-center gap-1 rounded-full bg-white/12 pl-2 pr-4 text-sm font-semibold" aria-label="Back to camera">
          <ChevronLeft className="size-5" aria-hidden /> Camera
        </button>
        <span className="text-sm font-semibold tabular-nums text-white/80">
          {index + 1} of {urls.length}
        </span>
        <span className="w-24" />
      </div>
      <div
        className="relative grid min-h-0 flex-1 place-items-center px-3"
        onTouchStart={(e) => (start.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          const s = start.current;
          start.current = null;
          if (s === null) return;
          const dx = e.changedTouches[0].clientX - s;
          if (dx > 50) go(index - 1);
          if (dx < -50) go(index + 1);
        }}
      >
        <img key={urls[index]} src={urls[index]} alt="Your shot" className="max-h-full max-w-full rounded-xl object-contain [animation:pc-develop_0.4s_ease]" />
        {index > 0 ? (
          <button type="button" onClick={() => go(index - 1)} className="absolute left-2 grid size-10 place-items-center rounded-full bg-black/40" aria-label="Previous shot">
            <ChevronLeft className="size-6" aria-hidden />
          </button>
        ) : null}
        {index < urls.length - 1 ? (
          <button type="button" onClick={() => go(index + 1)} className="absolute right-2 grid size-10 place-items-center rounded-full bg-black/40" aria-label="Next shot">
            <ChevronRight className="size-6" aria-hidden />
          </button>
        ) : null}
      </div>
      <p className="px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 text-center text-sm text-white/70">✓ Shared — it shows up in the album in a few seconds.</p>
    </div>
  );
}
