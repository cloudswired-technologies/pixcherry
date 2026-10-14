"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera as CameraIcon, RefreshCw, X } from "lucide-react";
import { FILTERS, applyFilter, cssFilter, vignetteCss } from "@/lib/client/filters";
import type { Quality } from "@/lib/client/compress";

// Disposable camera: full-screen viewfinder with film filters and a shots-left
// counter. Shots are resized + filtered on the phone and handed to the uploader.

type Mission = { id: string; title: string; emoji: string | null };

const MAX_CANVAS_PIXELS = 16_000_000;

function shutterSound() {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ac = new AC();
    const len = Math.floor(ac.sampleRate * 0.08);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    const src = ac.createBufferSource();
    const gain = ac.createGain();
    gain.gain.value = 0.35;
    src.buffer = buf;
    src.connect(gain).connect(ac.destination);
    src.start();
    src.onended = () => ac.close();
  } catch {
    /* sound is optional */
  }
}

export function DisposableCamera({
  open,
  onClose,
  onShot,
  onFallback,
  shotsLeft,
  quality,
  maxBytes,
  missions,
  mission,
  onMission,
  accent,
}: {
  open: boolean;
  onClose: () => void;
  onShot: (file: File) => void;
  onFallback: () => void;
  shotsLeft: number;
  quality: Quality;
  maxBytes: number;
  missions: Mission[];
  mission: string | null;
  onMission: (id: string | null) => void;
  accent: string;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [filter, setFilter] = useState(1); // "Film" by default: it's a disposable camera
  const [flash, setFlash] = useState(false);
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<string | null>(null);

  // Start / stop the stream with the overlay and when flipping cameras.
  useEffect(() => {
    if (!open) return;
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
        setError(name === "NotAllowedError" ? "Camera permission was blocked. Allow camera access for this site, or use your phone's camera instead." : "This browser can't open the camera here. Use your phone's camera instead.");
      }
    })();
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [open, facing]);

  useEffect(() => {
    if (!open) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [open]);

  const snap = useCallback(async () => {
    const v = video.current;
    if (!v || !ready || busy || shotsLeft <= 0 || !v.videoWidth) return;
    setBusy(true);
    setFlash(true);
    shutterSound();
    navigator.vibrate?.(25);
    setTimeout(() => setFlash(false), 140);
    try {
      let scale = quality.maxPx ? Math.min(1, quality.maxPx / Math.max(v.videoWidth, v.videoHeight)) : 1;
      scale = Math.min(scale, Math.sqrt(MAX_CANVAS_PIXELS / (v.videoWidth * v.videoHeight)));
      const w = Math.round(v.videoWidth * scale);
      const h = Math.round(v.videoHeight * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      if (facing === "user") {
        // Save selfies as seen in the viewfinder.
        ctx.translate(w, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(v, 0, 0, w, h);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      applyFilter(canvas, FILTERS[filter]);
      let q = quality.jpeg / 100;
      let blob: Blob | null = null;
      for (;;) {
        blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", q));
        if (!blob || blob.size <= maxBytes || q <= 0.55) break;
        q -= 0.1;
      }
      canvas.width = canvas.height = 0;
      if (blob) {
        const file = new File([blob], `pixcherry-${Date.now()}.jpg`, { type: "image/jpeg" });
        setLast((old) => {
          if (old) URL.revokeObjectURL(old);
          return URL.createObjectURL(file);
        });
        onShot(file);
      }
    } finally {
      setBusy(false);
    }
  }, [ready, busy, shotsLeft, quality, facing, filter, maxBytes, onShot]);

  if (!open) return null;
  const f = FILTERS[filter];
  const empty = shotsLeft <= 0;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black text-white" role="dialog" aria-modal="true" aria-label="Camera">
      <div className="flex items-center justify-between gap-2 px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button type="button" onClick={onClose} className="grid size-11 place-items-center rounded-full bg-white/10" aria-label="Close camera">
          <X className="size-6" aria-hidden />
        </button>
        <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 font-mono text-sm tracking-wider" aria-live="polite">
          <span aria-hidden>🎞</span>
          <span className={empty ? "text-[#ff8a75]" : ""}>{String(Math.max(0, shotsLeft)).padStart(2, "0")}</span>
          <span className="text-white/60">{shotsLeft === 1 ? "shot left" : "shots left"}</span>
        </div>
        <button
          type="button"
          onClick={() => {
            setReady(false);
            setError(null);
            setFacing((x) => (x === "user" ? "environment" : "user"));
          }} className="grid size-11 place-items-center rounded-full bg-white/10" aria-label="Switch camera">
          <RefreshCw className="size-5" aria-hidden />
        </button>
      </div>

      {missions.length ? (
        <div className="no-scrollbar flex gap-2 overflow-x-auto px-3 pb-2">
          <button type="button" onClick={() => onMission(null)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${mission ? "bg-white/10" : "bg-white text-black"}`}>
            Free shot
          </button>
          {missions.map((m) => (
            <button key={m.id} type="button" onClick={() => onMission(m.id)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${mission === m.id ? "bg-white text-black" : "bg-white/10"}`}>
              {m.emoji ?? "🎯"} {m.title}
            </button>
          ))}
        </div>
      ) : null}

      <div className="relative min-h-0 flex-1 overflow-hidden">
        {error ? (
          <div className="grid h-full place-items-center px-8 text-center">
            <div className="grid gap-4">
              <p className="text-sm text-white/80">{error}</p>
              <button type="button" onClick={onFallback} className="mx-auto inline-flex h-12 items-center gap-2 rounded-full px-6 font-semibold text-white" style={{ background: accent }}>
                <CameraIcon className="size-5" aria-hidden /> Use phone camera
              </button>
            </div>
          </div>
        ) : (
          <>
            <video
              ref={video}
              playsInline
              muted
              autoPlay
              className="absolute inset-0 size-full object-cover"
              style={{ filter: cssFilter(f), transform: facing === "user" ? "scaleX(-1)" : undefined }}
            />
            <div className="pointer-events-none absolute inset-0" style={{ background: vignetteCss(f) }} />
            {f.grain ? <div className="grain pointer-events-none absolute inset-0 opacity-[0.12] mix-blend-overlay" /> : null}
            {!ready ? <div className="absolute inset-0 grid place-items-center text-sm text-white/60">Opening camera…</div> : null}
            {empty ? (
              <div className="absolute inset-0 grid place-items-center bg-black/60 px-8 text-center">
                <div>
                  <div className="text-4xl">🎉</div>
                  <p className="mt-2 text-lg font-bold">That&apos;s the whole roll!</p>
                  <p className="text-sm text-white/70">Thanks for capturing the moments.</p>
                </div>
              </div>
            ) : null}
          </>
        )}
        <div className={`pointer-events-none absolute inset-0 bg-white transition-opacity duration-150 ${flash ? "opacity-90" : "opacity-0"}`} />
      </div>

      {!error ? (
        <div className="pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
          <div className="no-scrollbar flex snap-x gap-2 overflow-x-auto px-[calc(50%-2.5rem)] pb-4">
            {FILTERS.map((x, i) => (
              <button
                key={x.id}
                type="button"
                onClick={(ev) => {
                  setFilter(i);
                  ev.currentTarget.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
                }}
                className={`w-20 shrink-0 snap-center rounded-full py-1.5 text-xs font-semibold transition-colors ${i === filter ? "bg-white text-black" : "bg-white/10 text-white/80"}`}
              >
                {x.name}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between px-8">
            <div className="size-14 overflow-hidden rounded-xl border-2 border-white/40 bg-white/10">{last ? <img src={last} alt="Last shot" className="size-full object-cover" /> : null}</div>
            <button
              type="button"
              onClick={snap}
              disabled={!ready || busy || empty}
              aria-label="Take photo"
              className="grid size-20 place-items-center rounded-full border-4 border-white transition-transform active:scale-95 disabled:opacity-40"
            >
              <span className="size-16 rounded-full" style={{ background: accent }} />
            </button>
            <div className="size-14" />
          </div>
        </div>
      ) : null}
    </div>
  );
}
