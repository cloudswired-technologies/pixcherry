"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, Download, Heart, Loader2, MessageCircle, Share2, X, ZoomIn } from "lucide-react";
import type { GalleryPhoto } from "@/lib/photos";
import { CommentPreview, CommentsSheet, useComments } from "./comments";
import { initial } from "./panels";

type MissionMap = Map<string, { title: string; emoji: string | null }>;

/** Full-screen photo viewer: swipe, filmstrip, double-tap heart, download, share. */
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
  total,
  onTag,
  comments,
}: {
  onTag?: (tag: string) => void;
  /** Comments on: who's commenting, and how to report a new count back to the gallery. */
  comments?: { joined: boolean; canWrite: boolean; myName: string | null; onNeedJoin: () => void; onCount: (photoId: string, n: number) => void } | null;
  slug: string;
  photos: GalleryPhoto[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
  voting: boolean;
  onVote: (p: GalleryPhoto) => void;
  missions: MissionMap;
  onFolder: (guest: string, name: string | null) => void;
  total?: number;
}) {
  const ph = photos[index];
  const touch = useRef<{ x: number; y: number } | null>(null);
  const lastTap = useRef(0);
  const strip = useRef<HTMLDivElement>(null);
  const [burst, setBurst] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [talk, setTalk] = useState(false);
  // Zoom shows the full-size file (previews are lighter); pinch or the magnifier opens it.
  const [zoom, setZoom] = useState<string | null>(null);
  const talkRef = useRef(false);
  const zoomRef = useRef(false);
  useEffect(() => {
    talkRef.current = talk;
    zoomRef.current = zoom !== null;
  }, [talk, zoom]);
  const thread = useComments(slug, photos[index]?.id ?? "", !!comments && (talk || (photos[index]?.comments ?? 0) > 0));
  const go = (i: number) => {
    if (i < 0 || i >= photos.length) return;
    setDir(i > index ? 1 : -1);
    onIndex(i);
  };
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Phone back button closes the viewer.
  useEffect(() => {
    history.pushState({ pcViewer: true }, "");
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

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") return zoomRef.current ? setZoom(null) : talkRef.current ? setTalk(false) : history.back();
      if (talkRef.current) return;
      if (e.key === "ArrowLeft" && index > 0) onIndex(index - 1);
      if (e.key === "ArrowRight" && index < photos.length - 1) onIndex(index + 1);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [index, photos.length, onIndex]);

  useEffect(() => {
    for (const n of [photos[index + 1], photos[index - 1]]) if (n) new Image().src = n.md;
    strip.current?.querySelector<HTMLElement>(`[data-i="${index}"]`)?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [index, photos]);

  if (!ph) return null;
  const mission = ph.mission ? missions.get(ph.mission) : null;
  const heart = () => {
    if (!voting || ph.status !== "ready") return;
    if (!ph.voted) setBurst((b) => b + 1);
    onVote(ph);
  };
  const share = async () => {
    const url = `${location.origin}/api/e/${slug}/photos/${ph.id}/download`;
    try {
      const r = await fetch(url);
      const file = new File([await r.blob()], `pixcherry-${ph.id.slice(0, 8)}.jpg`, { type: "image/jpeg" });
      if (navigator.canShare?.({ files: [file] })) return await navigator.share({ files: [file] });
      if (navigator.share) return await navigator.share({ url: location.href });
    } catch {
      /* cancelled */
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Photo" className="fixed inset-0 z-50 flex flex-col bg-[#0b0b0d] text-white">
      <div className="flex items-center justify-between gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button type="button" onClick={close} className="grid size-10 place-items-center rounded-full hover:bg-white/10" aria-label="Close">
          <ChevronLeft className="size-6" aria-hidden />
        </button>
        <div className="text-sm font-semibold tabular-nums">
          {index + 1} of {Math.max(total ?? 0, photos.length)}
        </div>
        {ph.status === "ready" ? (
          <button type="button" onClick={() => setZoom(ph.full)} className="grid size-10 place-items-center rounded-full hover:bg-white/10" aria-label="Zoom in">
            <ZoomIn className="size-5" aria-hidden />
          </button>
        ) : (
          <div className="size-10" />
        )}
      </div>

      <div
        className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden"
        onDoubleClick={() => !ph.voted && heart()}
        onTouchStart={(e) => {
          if (e.touches.length === 2 && ph.status === "ready") {
            touch.current = null;
            return setZoom(ph.full);
          }
          touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }}
        onTouchEnd={(e) => {
          const s = touch.current;
          touch.current = null;
          if (!s) return;
          const dx = e.changedTouches[0].clientX - s.x;
          const dy = e.changedTouches[0].clientY - s.y;
          if (dy > 90 && Math.abs(dx) < 60) return close(); // swipe down to close
          if (dx > 50) return go(index - 1);
          if (dx < -50) return go(index + 1);
          const now = Date.now();
          if (now - lastTap.current < 300) {
            e.preventDefault();
            if (!ph.voted) heart();
            lastTap.current = 0;
            return;
          }
          lastTap.current = now;
        }}
      >
        <img
          key={ph.id}
          src={ph.md}
          alt=""
          draggable={false}
          className="max-h-full max-w-full select-none object-contain"
          style={{ animation: `${dir > 0 ? "pc-in-right" : "pc-in-left"} 0.3s ease` }}
        />
        {burst ? <Heart key={burst} className="pointer-events-none absolute size-28 fill-brand text-brand drop-shadow-lg [animation:pc-heart_0.8s_ease_forwards]" aria-hidden /> : null}
        {mission ? (
          <span className="absolute left-3 top-3 rounded-full bg-black/55 px-3 py-1 text-xs font-semibold backdrop-blur">
            {mission.emoji ?? "🎯"} {mission.title}
          </span>
        ) : null}
      </div>

      <div className="grid gap-3 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-full bg-brand font-bold">{initial(ph.by)}</span>
          <div className="min-w-0 flex-1">
            {ph.guest ? (
              <button type="button" className="block max-w-full truncate font-semibold hover:underline" onClick={() => onFolder(ph.guest!, ph.by)}>
                {ph.by ?? "Guest"}
              </button>
            ) : (
              <div className="font-semibold">Organiser</div>
            )}
            <div className="text-xs text-white/60">{new Date(ph.at).toLocaleString("en-MY", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })}</div>
          </div>
        </div>
        {ph.tags?.length ? (
          <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
            {ph.tags.map((t) => (
              <button key={t} type="button" onClick={() => onTag?.(t)} className="shrink-0 rounded-full bg-white/12 px-3 py-1 text-xs font-semibold">
                #{t}
              </button>
            ))}
          </div>
        ) : null}
        {comments ? <CommentPreview items={thread.items} count={ph.comments} onOpen={() => setTalk(true)} /> : null}
        <div ref={strip} className="no-scrollbar flex gap-1.5 overflow-x-auto">
          {photos.map((p, i) => (
            <button key={p.id} type="button" data-i={i} onClick={() => go(i)} className={`size-12 shrink-0 overflow-hidden rounded-lg border-2 ${i === index ? "border-white" : "border-transparent opacity-60"}`}>
              <img src={p.sm} alt="" loading="lazy" className="size-full object-cover" />
            </button>
          ))}
        </div>
        <div className="flex items-center justify-around border-t border-white/10 pt-2">
          {voting && ph.status === "ready" ? (
            <button type="button" onClick={heart} aria-pressed={ph.voted} aria-label={ph.voted ? "Remove heart" : "Heart this photo"} className="inline-flex h-11 items-center gap-2 rounded-full px-4 font-semibold">
              <Heart className={`size-6 transition-transform ${ph.voted ? "scale-110 fill-brand text-brand" : ""}`} aria-hidden />
              {ph.votes}
            </button>
          ) : null}
          {ph.status === "ready" ? (
            <a href={`/api/e/${slug}/photos/${ph.id}/download`} className="grid size-11 place-items-center rounded-full" aria-label="Download photo">
              <Download className="size-6" aria-hidden />
            </a>
          ) : null}
          {comments && ph.status === "ready" ? (
            <button type="button" onClick={() => setTalk(true)} aria-label="Comments" className="inline-flex h-11 items-center gap-2 rounded-full px-4 font-semibold">
              <MessageCircle className="size-6" aria-hidden />
              {ph.comments}
            </button>
          ) : null}
          <button type="button" onClick={share} className="grid size-11 place-items-center rounded-full" aria-label="Share photo">
            <Share2 className="size-6" aria-hidden />
          </button>
        </div>
      </div>
      {zoom ? <ZoomView src={zoom} onClose={() => setZoom(null)} /> : null}
      {talk && comments ? (
        <CommentsSheet
          slug={slug}
          photoId={ph.id}
          items={thread.items}
          set={thread.set}
          onClose={() => setTalk(false)}
          canWrite={comments.canWrite}
          joined={comments.joined}
          myName={comments.myName}
          onNeedJoin={comments.onNeedJoin}
          onCount={(n) => comments.onCount(ph.id, n)}
        />
      ) : null}
    </div>
  );
}

/** Full-size photo, twice the screen width, pan with a finger. */
function ZoomView({ src, onClose }: { src: string; onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="absolute inset-0 z-30 bg-black" role="dialog" aria-label="Zoomed photo">
      <div ref={box} className="size-full overflow-auto overscroll-contain">
        <img
          src={src}
          alt="Full size photo"
          className="block w-[220%] max-w-none sm:w-[160%]"
          onLoad={() => {
            setLoaded(true);
            const el = box.current;
            if (el) el.scrollTo({ left: (el.scrollWidth - el.clientWidth) / 2, top: (el.scrollHeight - el.clientHeight) / 2 });
          }}
        />
      </div>
      {!loaded ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <Loader2 className="size-8 animate-spin text-white/70" aria-label="Loading full size" />
        </div>
      ) : null}
      <button type="button" onClick={onClose} className="absolute right-3 top-[max(0.75rem,env(safe-area-inset-top))] grid size-10 place-items-center rounded-full bg-black/60 text-white" aria-label="Close zoom">
        <X className="size-5" aria-hidden />
      </button>
    </div>
  );
}
