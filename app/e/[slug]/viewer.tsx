"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Heart, X } from "lucide-react";
import type { GalleryPhoto } from "@/lib/photos";

type MissionMap = Map<string, { title: string; emoji: string | null }>;

/** Full-screen photo viewer: swipe, arrow keys, double-tap heart, download. */
export function Viewer({
  slug,
  photos,
  index,
  onIndex,
  onClose,
  voting,
  onVote,
  missions,
  onFolder,
}: {
  slug: string;
  photos: GalleryPhoto[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
  voting: boolean;
  onVote: (p: GalleryPhoto) => void;
  missions: MissionMap;
  onFolder: (guest: string, name: string | null) => void;
}) {
  const ph = photos[index];
  const touch = useRef<{ x: number; t: number } | null>(null);
  const lastTap = useRef(0);
  const [burst, setBurst] = useState(0);
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

  useEffect(() => {
    for (const n of [photos[index + 1], photos[index - 1]]) if (n) new Image().src = n.md;
  }, [index, photos]);

  if (!ph) return null;
  const mission = ph.mission ? missions.get(ph.mission) : null;
  const heart = () => {
    if (!voting || ph.status !== "ready") return;
    if (!ph.voted) setBurst((b) => b + 1);
    onVote(ph);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Photo"
      className="fixed inset-0 z-50 flex flex-col bg-black text-white"
      onTouchStart={(e) => (touch.current = { x: e.touches[0].clientX, t: Date.now() })}
      onTouchEnd={(e) => {
        const s = touch.current;
        touch.current = null;
        if (!s) return;
        const dx = e.changedTouches[0].clientX - s.x;
        if (dx > 50) return prev();
        if (dx < -50) return next();
        // Double tap = heart.
        const now = Date.now();
        if (now - lastTap.current < 300) {
          e.preventDefault(); // no synthetic dblclick: it would toggle the heart back
          if (!ph.voted) heart();
          lastTap.current = 0;
          return;
        }
        lastTap.current = now;
      }}
    >
      <div className="flex items-center justify-between gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="min-w-0 text-sm">
          {ph.guest ? (
            <button type="button" className="block max-w-full truncate font-semibold underline-offset-2 hover:underline" onClick={() => onFolder(ph.guest!, ph.by)}>
              {ph.by ?? "Guest"}
            </button>
          ) : (
            <div className="truncate font-semibold">Organiser</div>
          )}
          <div className="text-xs text-white/60">
            {new Date(ph.at).toLocaleString("en-MY", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
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

      <div className="relative flex min-h-0 flex-1 items-center justify-center" onDoubleClick={() => !ph.voted && heart()}>
        <img key={ph.id} src={ph.md} alt="" className="max-h-full max-w-full select-none object-contain" draggable={false} />
        {burst ? (
          <Heart key={burst} className="pointer-events-none absolute size-28 fill-white text-white drop-shadow-lg [animation:pc-heart_0.8s_ease_forwards]" aria-hidden />
        ) : null}
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

      <div className="flex items-center justify-between gap-3 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="min-w-0 text-xs text-white/70">
          {mission ? (
            <span className="inline-flex max-w-full items-center gap-1 truncate rounded-full bg-white/10 px-2.5 py-1">
              {mission.emoji ?? "🎯"} {mission.title}
            </span>
          ) : (
            <span>
              {index + 1} / {photos.length}
            </span>
          )}
        </div>
        {voting && ph.status === "ready" ? (
          <button
            type="button"
            onClick={heart}
            aria-pressed={ph.voted}
            aria-label={ph.voted ? "Remove heart" : "Heart this photo"}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-white/10 px-4 font-semibold"
          >
            <Heart className={`size-5 transition-transform ${ph.voted ? "scale-110 fill-[#ff4d6d] text-[#ff4d6d]" : ""}`} aria-hidden />
            {ph.votes}
          </button>
        ) : null}
      </div>
    </div>
  );
}
