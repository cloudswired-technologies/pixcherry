"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronLeft, Download, Flag, Heart, Loader2, Pencil, Share2, ZoomIn, ZoomOut } from "lucide-react";
import { ZoomableImage, type ZoomHandle } from "@/components/zoomable";
import type { GalleryPhoto } from "@/lib/photos";
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
  onCaption,
  onReport,
}: {
  onTag?: (tag: string) => void;
  /** I reported someone else's photo: drop it from my gallery. Absent = can't report (not joined). */
  onReport?: (photoId: string) => void;
  /** Caption saved for one of my photos: update the gallery. Absent = captions can't be edited here. */
  onCaption?: (photoId: string, caption: string | null) => void;
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
  const strip = useRef<HTMLDivElement>(null);
  const [burst, setBurst] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  // Editing my caption: { id, text } of the photo being captioned.
  const [edit, setEdit] = useState<{ id: string; text: string; busy?: boolean } | null>(null);
  // Zoom happens in place (pinch, wheel or the magnifier); swiping waits until zoomed out.
  const [zoomed, setZoomed] = useState(false);
  const zoomer = useRef<ZoomHandle>(null);
  // Reporting a photo: confirm sheet for this photo id.
  const [report, setReport] = useState<{ id: string; busy?: boolean; error?: string } | null>(null);
  const editRef = useRef(false);
  const zoomRef = useRef(false);
  useEffect(() => {
    editRef.current = edit !== null || report !== null;
    zoomRef.current = zoomed;
  }, [edit, report, zoomed]);
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
      if (e.key === "Escape") {
        if (zoomRef.current) return zoomer.current?.reset();
        if (editRef.current) {
          setEdit(null);
          setReport(null);
          return;
        }
        return history.back();
      }
      if (editRef.current) return;
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
  const saveCaption = async () => {
    if (!edit || edit.busy) return;
    setEdit({ ...edit, busy: true });
    const r = await fetch(`/api/e/${slug}/photos/${edit.id}/caption`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ caption: edit.text }) }).catch(() => null);
    if (r?.ok) {
      const b = (await r.json()) as { caption: string | null };
      onCaption?.(edit.id, b.caption);
      setEdit(null);
    } else setEdit({ ...edit, busy: false });
  };
  const sendReport = async () => {
    if (!report || report.busy) return;
    setReport({ ...report, busy: true, error: undefined });
    const r = await fetch(`/api/e/${slug}/photos/${report.id}/report`, { method: "POST" }).catch(() => null);
    if (r?.ok) {
      setReport(null);
      onReport?.(report.id);
    } else {
      const b = (await r?.json().catch(() => null)) as { error?: string } | null;
      setReport({ ...report, busy: false, error: b?.error ?? "Couldn't send. Check your connection." });
    }
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
          <button type="button" onClick={() => zoomer.current?.toggle()} className="grid size-10 place-items-center rounded-full hover:bg-white/10" aria-label={zoomed ? "Zoom out" : "Zoom in"}>
            {zoomed ? <ZoomOut className="size-5" aria-hidden /> : <ZoomIn className="size-5" aria-hidden />}
          </button>
        ) : (
          <div className="size-10" />
        )}
      </div>

      <div
        className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden"
        onTouchStart={(e) => {
          touch.current = e.touches.length === 1 && !zoomRef.current ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
        }}
        onTouchEnd={(e) => {
          const s = touch.current;
          touch.current = null;
          if (!s || zoomRef.current) return;
          const dx = e.changedTouches[0].clientX - s.x;
          const dy = e.changedTouches[0].clientY - s.y;
          if (dy > 90 && Math.abs(dx) < 60) return close(); // swipe down to close
          if (dx > 50) return go(index - 1);
          if (dx < -50) return go(index + 1);
        }}
      >
        <div key={ph.id} className="absolute inset-0" style={{ animation: `${dir > 0 ? "pc-in-right" : "pc-in-left"} 0.3s ease` }}>
          <ZoomableImage
            src={ph.md}
            full={ph.status === "ready" ? ph.full : undefined}
            alt={ph.by ? `Photo by ${ph.by}` : "Event photo"}
            handle={zoomer}
            onZoomChange={setZoomed}
            // Double-tap hearts the photo (pinch or the magnifier to zoom).
            onDoubleTap={voting && ph.status === "ready" ? () => !ph.voted && heart() : undefined}
          />
        </div>
        {burst ? <Heart key={burst} className="pointer-events-none absolute size-28 fill-brand text-brand drop-shadow-lg [animation:pc-heart_0.8s_ease_forwards]" aria-hidden /> : null}
        {mission ? (
          <span className="absolute left-3 top-3 rounded-full bg-black/55 px-3 py-1 text-xs font-semibold backdrop-blur">
            {mission.emoji ?? "🎯"} {mission.title}
          </span>
        ) : null}
      </div>

      <div className="grid gap-3 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
        <div className="flex items-center gap-3">
          {ph.avatar ? (
            <img src={ph.avatar} alt="" className="size-10 shrink-0 rounded-full object-cover" />
          ) : (
            <span className="grid size-10 place-items-center rounded-full bg-brand font-bold">{initial(ph.by)}</span>
          )}
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
        {edit && edit.id === ph.id ? (
          <div className="flex items-center gap-2">
            <input
              value={edit.text}
              onChange={(e) => setEdit({ ...edit, text: e.target.value.slice(0, 140) })}
              onKeyDown={(e) => e.key === "Enter" && saveCaption()}
              autoFocus
              placeholder="Say something about this photo…"
              aria-label="Caption"
              className="h-10 min-w-0 flex-1 rounded-full bg-white/12 px-4 text-sm outline-none placeholder:text-white/50"
            />
            <button type="button" onClick={saveCaption} disabled={edit.busy} className="grid size-10 place-items-center rounded-full bg-brand disabled:opacity-60" aria-label="Save caption">
              {edit.busy ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Check className="size-5" aria-hidden />}
            </button>
          </div>
        ) : ph.caption ? (
          <p className="flex items-start gap-2 text-[15px] leading-snug">
            <span className="min-w-0 flex-1 break-words">{ph.caption}</span>
            {ph.mine && onCaption ? (
              <button type="button" onClick={() => setEdit({ id: ph.id, text: ph.caption ?? "" })} className="grid size-8 shrink-0 place-items-center rounded-full bg-white/10" aria-label="Edit caption">
                <Pencil className="size-4" aria-hidden />
              </button>
            ) : null}
          </p>
        ) : ph.mine && onCaption ? (
          <button type="button" onClick={() => setEdit({ id: ph.id, text: "" })} className="inline-flex w-fit items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-sm font-semibold">
            <Pencil className="size-4" aria-hidden /> Add a caption
          </button>
        ) : null}
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
          <button type="button" onClick={share} className="grid size-11 place-items-center rounded-full" aria-label="Share photo">
            <Share2 className="size-6" aria-hidden />
          </button>
          {onReport && !ph.mine && ph.status === "ready" ? (
            <button type="button" onClick={() => setReport({ id: ph.id })} className="grid size-11 place-items-center rounded-full text-white/70" aria-label="Report photo">
              <Flag className="size-5" aria-hidden />
            </button>
          ) : null}
        </div>
      </div>

      {report ? (
        <div className="absolute inset-0 z-10 flex items-end bg-black/60 sm:items-center sm:justify-center" onClick={() => !report.busy && setReport(null)}>
          <div
            role="alertdialog"
            aria-label="Report this photo?"
            className="w-full rounded-t-3xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-ink sm:max-w-sm sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <Flag className="size-5 text-danger" aria-hidden /> Report this photo?
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Inappropriate or posted without permission? It disappears for you right away. If another guest reports it too, it&apos;s hidden until the host checks it.
            </p>
            {report.error ? <p className="mt-2 text-sm font-semibold text-danger">{report.error}</p> : null}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setReport(null)} disabled={report.busy} className="h-11 rounded-full border border-border font-semibold">
                Cancel
              </button>
              <button type="button" onClick={sendReport} disabled={report.busy} className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-danger font-semibold text-white disabled:opacity-60">
                {report.busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} Report
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
