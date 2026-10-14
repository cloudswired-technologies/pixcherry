"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ChevronLeft, RefreshCw, RotateCcw } from "lucide-react";
import { LOOKS, createRenderer, drawOverlays, polaroid, stampText, type Look, type Renderer } from "@/lib/client/glfx";
import { playAdvance, playShutter, unlockAudio } from "@/lib/client/camera-sounds";
import type { Quality } from "@/lib/client/compress";

// Disposable camera. GPU viewfinder with film looks (the photo is rendered by
// the same shader), mechanical shutter + film-advance sounds, a review step
// before anything is shared, and a clear way back to the album.

type Mission = { id: string; title: string; emoji: string | null };
type Shot = { file: File; url: string };

const MAX_CANVAS_PIXELS = 16_000_000;

export function DisposableCamera({
  onClose,
  onShot,
  onFallback,
  shotsLeft,
  quality,
  maxBytes,
  missions,
  mission,
  onMission,
  caption,
}: {
  open?: boolean;
  onClose: () => void;
  onShot: (file: File) => void;
  onFallback: () => void;
  shotsLeft: number;
  quality: Quality;
  maxBytes: number;
  missions: Mission[];
  mission: string | null;
  onMission: (id: string | null) => void;
  accent?: string;
  caption: string;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const view = useRef<HTMLCanvasElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const renderer = useRef<Renderer | null>(null);
  const capture = useRef<Renderer | null>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [gl, setGl] = useState(true);
  const [lookIdx, setLookIdx] = useState(1);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [shutter, setShutter] = useState(0);
  const [review, setReview] = useState<Shot | null>(null);
  const [busy, setBusy] = useState(false);
  const [flyKey, setFlyKey] = useState(0);
  const [last, setLast] = useState<string | null>(null);
  const look = LOOKS[lookIdx];
  const lookRef = useRef<Look>(look);
  useEffect(() => {
    lookRef.current = look;
  }, [look]);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Back button / gesture closes the camera instead of leaving the album.
  useEffect(() => {
    history.pushState({ pcCamera: true }, "");
    const pop = () => onCloseRef.current();
    window.addEventListener("popstate", pop);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("popstate", pop);
      document.body.style.overflow = overflow;
    };
  }, []);
  const close = () => history.back();

  // Camera stream.
  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("unsupported");
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facing }, width: { ideal: 2560 }, height: { ideal: 1920 } },
          audio: false,
        });
        if (cancelled) return stream.getTracks().forEach((t) => t.stop());
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
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [facing]);

  // Fit the viewfinder to the camera's aspect ratio (what you see is what you get).
  useEffect(() => {
    const el = stage.current;
    const v = video.current;
    if (!el || !v) return;
    const fit = () => {
      const vw = v.videoWidth || 3;
      const vh = v.videoHeight || 4;
      const frame = look.polaroid ? { x: 1.12, y: 1.28 } : { x: 1, y: 1 };
      const aw = el.clientWidth / frame.x;
      const ah = el.clientHeight / frame.y;
      const s = Math.min(aw / vw, ah / vh);
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
      capture.current?.dispose();
    },
    [],
  );

  const snap = useCallback(async () => {
    const v = video.current;
    if (!v || !ready || busy || shotsLeft <= 0 || !v.videoWidth) return;
    unlockAudio();
    playShutter();
    navigator.vibrate?.(30);
    setShutter((s) => s + 1);
    stage.current?.animate(
      [{ transform: "translate(0,0)" }, { transform: "translate(-3px,2px)" }, { transform: "translate(3px,-2px)" }, { transform: "translate(0,0)" }],
      { duration: 220, easing: "ease-out" },
    );
    setBusy(true);
    try {
      let scale = quality.maxPx ? Math.min(1, quality.maxPx / Math.max(v.videoWidth, v.videoHeight)) : 1;
      scale = Math.min(scale, Math.sqrt(MAX_CANVAS_PIXELS / (v.videoWidth * v.videoHeight)));
      let w = Math.round(v.videoWidth * scale);
      let h = Math.round(v.videoHeight * scale);
      const out = document.createElement("canvas");
      const l = lookRef.current;
      if (gl) {
        const cc = (capture.current?.canvas as HTMLCanvasElement) ?? document.createElement("canvas");
        if (!capture.current) capture.current = createRenderer(cc, true);
        const r = capture.current;
        if (r) {
          const lim = r.maxSize;
          if (Math.max(w, h) > lim) {
            const k = lim / Math.max(w, h);
            w = Math.round(w * k);
            h = Math.round(h * k);
          }
          cc.width = w;
          cc.height = h;
          r.draw(v, l, { mirror: facing === "user", time: Math.random() * 100 });
        }
        out.width = w;
        out.height = h;
        out.getContext("2d")!.drawImage(cc, 0, 0, w, h);
      } else {
        out.width = w;
        out.height = h;
        const c2 = out.getContext("2d")!;
        if (facing === "user") {
          c2.translate(w, 0);
          c2.scale(-1, 1);
        }
        c2.drawImage(v, 0, 0, w, h);
        c2.setTransform(1, 0, 0, 1, 0, 0);
      }
      drawOverlays(out.getContext("2d")!, w, h, l);
      const final = l.polaroid ? polaroid(out, caption) : out;
      let q = quality.jpeg / 100;
      let blob: Blob | null = null;
      for (;;) {
        blob = await new Promise<Blob | null>((res) => final.toBlob(res, "image/jpeg", q));
        if (!blob || blob.size <= maxBytes || q <= 0.55) break;
        q -= 0.1;
      }
      out.width = out.height = 0;
      if (blob) {
        const file = new File([blob], `pixcherry-${Date.now()}.jpg`, { type: "image/jpeg" });
        setTimeout(() => setReview({ file, url: URL.createObjectURL(file) }), 180);
      }
    } finally {
      setTimeout(() => setBusy(false), 200);
    }
  }, [ready, busy, shotsLeft, quality, facing, gl, maxBytes, caption]);

  const share = () => {
    if (!review) return;
    playAdvance();
    navigator.vibrate?.([10, 30, 10, 30, 10]);
    onShot(review.file);
    setLast((old) => {
      if (old) URL.revokeObjectURL(old);
      return review.url;
    });
    setFlyKey((k) => k + 1);
    setReview(null);
  };

  const retake = () => {
    if (review) URL.revokeObjectURL(review.url);
    setReview(null);
  };

  const empty = shotsLeft <= 0;
  const stampSize = Math.max(10, Math.round(Math.min(box.w, box.h) * (look.stamp === "vhs" ? 0.04 : 0.055)));

  return (
    <div className="fixed inset-0 z-[60] flex select-none flex-col bg-[#0b0b0d] text-white" role="dialog" aria-modal="true" aria-label="Camera">
      {/* top bar */}
      <div className="flex items-center justify-between gap-2 px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button type="button" onClick={close} className="inline-flex h-10 items-center gap-1 rounded-full bg-white/12 pl-2 pr-4 text-sm font-semibold backdrop-blur" aria-label="Back to album">
          <ChevronLeft className="size-5" aria-hidden /> Album
        </button>
        <div className="flex items-center gap-2 rounded-full bg-white/12 px-3 py-1.5" aria-live="polite">
          <span className="rounded bg-[#ff9d2e] px-1.5 font-mono text-sm font-bold tabular-nums text-black">{String(Math.max(0, shotsLeft)).padStart(2, "0")}</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-white/70">{shotsLeft === 1 ? "shot left" : "shots left"}</span>
        </div>
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
            className="relative overflow-hidden"
            style={
              look.polaroid
                ? { padding: `${box.w * 0.06}px ${box.w * 0.06}px ${box.w * 0.22}px`, background: "#fbf8f1", borderRadius: 6 }
                : { borderRadius: 14 }
            }
          >
            <div className="relative overflow-hidden" style={{ width: box.w, height: box.h, borderRadius: look.polaroid ? 0 : 14 }}>
              {gl ? <canvas ref={view} className="block size-full" /> : null}
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
                {caption.slice(0, 40)}
              </div>
            ) : null}
          </div>
        )}
        {/* review sits on top so the live canvas (and its GL context) stays mounted */}
        {review ? (
          <div className="absolute inset-0 grid place-items-center bg-[#0b0b0d] px-4">
            <img src={review.url} alt="Your photo" className="max-h-full max-w-full rounded-xl shadow-2xl [animation:pc-develop_0.6s_ease]" />
          </div>
        ) : null}
        {/* shutter curtains + flash */}
        {shutter ? (
          <div key={shutter} className="pointer-events-none absolute inset-0">
            <div className="absolute inset-x-0 top-0 h-1/2 origin-top scale-y-0 bg-black [animation:pc-curtain_0.26s_ease_forwards]" />
            <div className="absolute inset-x-0 bottom-0 h-1/2 origin-bottom scale-y-0 bg-black [animation:pc-curtain_0.26s_ease_forwards]" />
            <div className="absolute inset-0 bg-white [animation:pc-flash_0.35s_ease_forwards]" />
          </div>
        ) : null}
      </div>

      {/* bottom controls */}
      {review ? (
        <div className="grid gap-3 px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
          <p className="text-center text-sm text-white/70">Happy with it? Only shared photos use a shot.</p>
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={retake} className="inline-flex h-14 items-center justify-center gap-2 rounded-full border border-white/25 font-semibold">
              <RotateCcw className="size-5" aria-hidden /> Retake
            </button>
            <button type="button" onClick={share} className="inline-flex h-14 items-center justify-center gap-2 rounded-full bg-brand font-semibold shadow-cherry">
              <Check className="size-5" aria-hidden /> Share
            </button>
          </div>
        </div>
      ) : !error ? (
        <div className="pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
          <div className="no-scrollbar flex snap-x gap-3 overflow-x-auto px-[calc(50%-1.75rem)] pb-4">
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
            <div className="relative size-14 overflow-hidden rounded-xl border-2 border-white/40 bg-white/10">
              {last ? <img key={flyKey} src={last} alt="Last shot" className="size-full object-cover [animation:pc-fly_0.5s_ease]" /> : null}
            </div>
            <button
              type="button"
              onClick={snap}
              disabled={!ready || busy || empty}
              aria-label="Take photo"
              className="grid size-20 place-items-center rounded-full border-4 border-white transition-transform active:scale-90 disabled:opacity-40"
            >
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
