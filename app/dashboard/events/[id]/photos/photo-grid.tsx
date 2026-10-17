"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Download, Heart, Trash2, X, ZoomIn, ZoomOut } from "lucide-react";
import { Confirm } from "@/components/confirm";
import { cn } from "@/components/ui";
import { ZoomableImage, type ZoomHandle } from "@/components/zoomable";
import { approve, removePhoto } from "../../actions";

// Organiser photo grid. A photo opens in a lightbox on the same page (zoom in
// place, previous/next, details, download, delete) instead of a new tab. Tick
// photos (or select all) to download just those as one ZIP.

export type GridPhoto = {
  id: string;
  sm: string;
  md: string;
  full: string;
  name: string | null;
  guestHref: string | null;
  at: string;
  caption: string | null;
  tags: string[];
  votes: number;
  emoji: string | null;
  review: boolean;
  /** Why it needs a look: AI hid it, AI unsure, or guests reported it. */
  flag: "ai" | "ai_soft" | "report" | null;
  reports: number;
};

function badge(p: GridPhoto) {
  if (p.review && p.flag === "ai") return { text: "Hidden by AI", cls: "bg-danger text-white" };
  if (p.review && p.flag === "report") return { text: `Reported by ${p.reports} guests`, cls: "bg-danger text-white" };
  if (p.review) return { text: "To approve", cls: "bg-warn text-white" };
  if (p.flag === "ai_soft") return { text: "AI: check", cls: "bg-white text-warn ring-1 ring-warn" };
  if (p.flag === "report" || p.reports) return { text: `Reported (${p.reports})`, cls: "bg-white text-warn ring-1 ring-warn" };
  return null;
}

export function PhotoGrid({ eventId, slug, photos }: { eventId: string; slug: string; photos: GridPhoto[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const at = open ? photos.findIndex((p) => p.id === open) : -1;
  const all = photos.length > 0 && photos.every((p) => picked.has(p.id));
  const toggle = (id: string) =>
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  return (
    <>
      <div className="sticky top-14 z-20 flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card/95 px-3 py-2 shadow-soft backdrop-blur lg:top-2">
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={all} onChange={() => setPicked(all ? new Set() : new Set(photos.map((p) => p.id)))} className="size-5 accent-brand" />
          Select all on this page
        </label>
        <span className="text-sm text-muted-foreground">{picked.size ? `${picked.size} selected` : "or tick photos to download just those"}</span>
        <span className="flex-1" />
        {picked.size ? (
          <>
            <button type="button" onClick={() => setPicked(new Set())} className="inline-flex h-9 items-center rounded-full px-3 text-sm font-semibold text-muted-foreground hover:bg-muted">
              Clear
            </button>
            <form action={`/api/events/${eventId}/zip`} method="post">
              <input type="hidden" name="ids" value={[...picked].join(",")} />
              <button className="inline-flex h-9 items-center gap-1.5 rounded-full bg-brand px-4 text-sm font-bold text-white shadow-cherry">
                <Download className="size-4" aria-hidden /> Download {picked.size} selected
              </button>
            </form>
          </>
        ) : null}
        <a href={`/api/e/${slug}/album`} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-4 text-sm font-semibold hover:bg-muted">
          <Download className="size-4" aria-hidden /> Whole album
        </a>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {photos.map((p) => (
          <div key={p.id} className={cn("relative overflow-hidden rounded-2xl border bg-card shadow-soft", picked.has(p.id) ? "border-brand ring-2 ring-brand" : p.review || p.flag ? "border-warn" : "border-border")}>
            <label className="absolute left-2 top-2 z-10 grid size-8 cursor-pointer place-items-center rounded-full bg-white/90 shadow-soft" title="Select">
              <input type="checkbox" checked={picked.has(p.id)} onChange={() => toggle(p.id)} className="size-4 accent-brand" aria-label={`Select photo${p.name ? ` by ${p.name}` : ""}`} />
            </label>
            <button type="button" onClick={() => setOpen(p.id)} className="relative block w-full overflow-hidden" aria-label={`Open photo${p.name ? ` by ${p.name}` : ""}`}>
              <img src={p.sm} alt={p.name ? `Photo by ${p.name}` : "Event photo"} loading="lazy" className={cn("aspect-square w-full bg-muted object-cover transition-transform hover:scale-[1.02]", p.review && p.flag && "blur-lg")} />
              {p.emoji ? <span className="absolute left-12 top-2 rounded-full bg-white/90 px-1.5 text-sm">{p.emoji}</span> : null}
              {badge(p) ? <span className={cn("absolute right-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-bold", badge(p)!.cls)}>{badge(p)!.text}</span> : null}
              {p.votes ? (
                <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-semibold text-white">
                  <Heart className="size-3 fill-white" aria-hidden /> {p.votes}
                </span>
              ) : null}
            </button>
            <div className="grid gap-1.5 p-2.5">
              <div className="flex items-center justify-between gap-2">
                {p.guestHref ? (
                  <Link href={p.guestHref} className="min-w-0 truncate text-sm font-semibold hover:underline">
                    {p.name ?? "Guest"}
                  </Link>
                ) : (
                  <span className="text-sm font-semibold">Organiser</span>
                )}
                <Actions eventId={eventId} p={p} />
              </div>
              <div className="text-[11px] text-muted-foreground">
                {p.caption ? <span className="mb-0.5 line-clamp-2 block text-xs text-foreground">“{p.caption}”</span> : null}
                <span className="block truncate">
                  {p.at}
                  {p.tags.length ? ` · ${p.tags.map((t) => `#${t}`).join(" ")}` : ""}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
      {at >= 0 ? <Lightbox eventId={eventId} slug={slug} photos={photos} index={at} onIndex={(i) => setOpen(photos[i].id)} onClose={() => setOpen(null)} /> : null}
    </>
  );
}

function Actions({ eventId, p, dark }: { eventId: string; p: GridPhoto; dark?: boolean }) {
  return (
    <div className="flex shrink-0 gap-1">
      {p.review || p.flag ? (
        <form action={approve.bind(null, eventId, [p.id])}>
          <button className="grid size-8 place-items-center rounded-full bg-ok-soft text-ok" aria-label="Approve photo" title="Looks fine: show it in the album">
            <Check className="size-4" aria-hidden />
          </button>
        </form>
      ) : null}
      <Confirm
        action={removePhoto.bind(null, eventId, p.id)}
        title="Delete this photo?"
        message="It disappears from the album, the slideshow and downloads. This can't be undone."
        confirm="Delete photo"
        label="Delete photo"
        className={cn("grid size-8 place-items-center rounded-full", dark ? "bg-white/10 text-white hover:bg-danger" : "bg-danger-soft text-danger")}
      >
        <Trash2 className="size-4" aria-hidden />
      </Confirm>
    </div>
  );
}

function Lightbox({ eventId, slug, photos, index, onIndex, onClose }: { eventId: string; slug: string; photos: GridPhoto[]; index: number; onIndex: (i: number) => void; onClose: () => void }) {
  const p = photos[index];
  const zoomer = useRef<ZoomHandle>(null);
  const [zoomed, setZoomed] = useState(false);
  const go = (i: number) => i >= 0 && i < photos.length && onIndex(i);
  const nav = useRef({ index, len: photos.length, onIndex, onClose });
  useEffect(() => {
    nav.current = { index, len: photos.length, onIndex, onClose };
  });
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const n = nav.current;
      if (e.key === "Escape") n.onClose();
      if (e.key === "ArrowLeft" && n.index > 0) n.onIndex(n.index - 1);
      if (e.key === "ArrowRight" && n.index < n.len - 1) n.onIndex(n.index + 1);
    };
    window.addEventListener("keydown", key);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", key);
      document.body.style.overflow = overflow;
    };
  }, []);
  useEffect(() => {
    for (const n of [photos[index + 1], photos[index - 1]]) if (n) new Image().src = n.md;
  }, [index, photos]);
  if (!p) return null;
  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-[#0b0b0d]/95 text-white backdrop-blur lg:flex-row" role="dialog" aria-modal="true" aria-label="Photo">
      <div className="relative min-h-0 flex-1">
        <ZoomableImage key={p.id} src={p.md} preview={p.sm} full={p.full} alt={p.name ? `Photo by ${p.name}` : "Event photo"} handle={zoomer} onZoomChange={setZoomed} />
        {!zoomed && index > 0 ? (
          <button type="button" onClick={() => go(index - 1)} className="absolute left-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-black/50 hover:bg-black/70" aria-label="Previous photo">
            <ChevronLeft className="size-6" aria-hidden />
          </button>
        ) : null}
        {!zoomed && index < photos.length - 1 ? (
          <button type="button" onClick={() => go(index + 1)} className="absolute right-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-black/50 hover:bg-black/70" aria-label="Next photo">
            <ChevronRight className="size-6" aria-hidden />
          </button>
        ) : null}
        <div className="absolute left-3 top-3 flex gap-2">
          <button type="button" onClick={onClose} className="grid size-10 place-items-center rounded-full bg-black/50 hover:bg-black/70" aria-label="Close photo">
            <X className="size-5" aria-hidden />
          </button>
          <button type="button" onClick={() => zoomer.current?.toggle()} className="grid size-10 place-items-center rounded-full bg-black/50 hover:bg-black/70" aria-label={zoomed ? "Zoom out" : "Zoom in"}>
            {zoomed ? <ZoomOut className="size-5" aria-hidden /> : <ZoomIn className="size-5" aria-hidden />}
          </button>
        </div>
        <span className="absolute right-3 top-4 rounded-full bg-black/50 px-3 py-1 text-xs font-semibold tabular-nums">
          {index + 1} / {photos.length}
        </span>
      </div>
      <aside className="grid content-start gap-3 border-t border-white/10 p-4 lg:w-80 lg:border-l lg:border-t-0 lg:p-6">
        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand font-bold">{(p.name ?? "G").charAt(0).toUpperCase()}</span>
          <div className="min-w-0 flex-1">
            <div className="truncate font-bold">{p.name ?? "Organiser"}</div>
            <div className="text-xs text-white/60">{p.at}</div>
          </div>
          <Actions eventId={eventId} p={p} dark />
        </div>
        {p.caption ? <p className="text-[15px] leading-snug">“{p.caption}”</p> : <p className="text-sm text-white/50">No caption.</p>}
        <div className="flex flex-wrap gap-1.5 text-xs">
          {p.emoji ? <span className="rounded-full bg-white/10 px-2.5 py-1">{p.emoji} mission</span> : null}
          {p.tags.map((t) => (
            <span key={t} className="rounded-full bg-white/10 px-2.5 py-1">
              #{t}
            </span>
          ))}
          <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1">
            <Heart className="size-3" aria-hidden /> {p.votes}
          </span>
        </div>
        <a href={`/api/e/${slug}/photos/${p.id}/download`} className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-white text-sm font-bold text-ink">
          <Download className="size-4" aria-hidden /> Download{p.caption ? " with caption" : ""}
        </a>
        <p className="hidden text-xs text-white/40 lg:block">Pinch, scroll or double-click to zoom · ← → for next</p>
      </aside>
    </div>
  );
}
