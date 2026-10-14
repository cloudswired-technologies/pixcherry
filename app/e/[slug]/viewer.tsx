"use client";

import { useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";
import type { GalleryPhoto } from "@/lib/photos";

/** Full-screen photo viewer with swipe, arrow keys and download. */
export function Viewer({ slug, photos, index, onIndex, onClose }: { slug: string; photos: GalleryPhoto[]; index: number; onIndex: (i: number) => void; onClose: () => void }) {
  const ph = photos[index];
  const touch = useRef<number | null>(null);
  const prev = () => index > 0 && onIndex(index - 1);
  const next = () => index < photos.length - 1 && onIndex(index + 1);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && index > 0) onIndex(index - 1);
      if (e.key === "ArrowRight" && index < photos.length - 1) onIndex(index + 1);
    };
    window.addEventListener("keydown", key);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", key);
      document.body.style.overflow = overflow;
    };
  }, [index, photos.length, onIndex, onClose]);

  // Preload neighbours so swiping feels instant.
  useEffect(() => {
    for (const n of [photos[index + 1], photos[index - 1]]) if (n) new Image().src = n.md;
  }, [index, photos]);

  if (!ph) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Photo"
      className="fixed inset-0 z-50 flex flex-col bg-black text-white"
      onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touch.current === null) return;
        const dx = e.changedTouches[0].clientX - touch.current;
        touch.current = null;
        if (dx > 50) prev();
        if (dx < -50) next();
      }}
    >
      <div className="flex items-center justify-between gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="min-w-0 text-sm">
          <div className="truncate font-semibold">{ph.by ?? "Guest"}</div>
          <div className="text-xs text-white/60">
            {new Date(ph.at).toLocaleString("en-MY", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })} · {ph.w}×{ph.h}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {ph.status === "ready" ? (
            <a href={`/api/e/${slug}/photos/${ph.id}/download`} className="grid size-10 place-items-center rounded-full hover:bg-white/10" aria-label="Download photo">
              <Download className="size-5" aria-hidden />
            </a>
          ) : null}
          <button type="button" onClick={onClose} className="grid size-10 place-items-center rounded-full hover:bg-white/10" aria-label="Close">
            <X className="size-6" aria-hidden />
          </button>
        </div>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center">
        <img key={ph.id} src={ph.md} alt="" className="max-h-full max-w-full object-contain" />
        {index > 0 ? (
          <button type="button" onClick={prev} className="absolute left-2 hidden size-11 place-items-center rounded-full bg-white/10 sm:grid" aria-label="Previous">
            <ChevronLeft aria-hidden />
          </button>
        ) : null}
        {index < photos.length - 1 ? (
          <button type="button" onClick={next} className="absolute right-2 hidden size-11 place-items-center rounded-full bg-white/10 sm:grid" aria-label="Next">
            <ChevronRight aria-hidden />
          </button>
        ) : null}
      </div>
      <div className="p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-center text-xs text-white/50">
        {index + 1} / {photos.length}
      </div>
    </div>
  );
}
