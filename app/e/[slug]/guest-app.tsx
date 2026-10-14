"use client";

import Link from "next/link";
import { useActionState, useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { Camera, CheckCircle2, Download, ImagePlus, Loader2, RotateCw, X } from "lucide-react";
import { Turnstile } from "@/components/turnstile";
import { Logo } from "@/components/ui";
import type { Quality } from "@/lib/client/compress";
import { useUploader } from "@/lib/client/uploader";
import type { GalleryPhoto } from "@/lib/photos";
import { join, type JoinState } from "./actions";
import { Viewer } from "./viewer";

type Props = {
  slug: string;
  event: { name: string; description: string; date: string; cover: string | null; logo: string | null; accent: string; poweredBy: boolean; askName: boolean; review: boolean };
  canUpload: boolean;
  guest: { name: string | null; uploaded: number; blocked: boolean } | null;
  limits: { perGuest: number; maxBytes: number };
  quality: Quality;
  albumDownload: boolean;
  initial: { photos: GalleryPhoto[]; next: string | null; count: number };
  siteKey: string | null;
};

export function GuestApp(p: Props) {
  const [joined, setJoined] = useState(p.guest);
  const style = { "--accent": p.event.accent } as CSSProperties;
  const gallery = useGallery(p.slug, p.initial);

  return (
    <div style={style} className="min-h-dvh pb-16">
      <header className="relative">
        {p.event.cover ? (
          <div className="relative h-48 sm:h-64">
            <img src={p.event.cover} alt="" className="size-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          </div>
        ) : (
          <div className="h-20" style={{ background: `linear-gradient(135deg, ${p.event.accent}, ${p.event.accent}99)` }} />
        )}
        <div className="mx-auto -mt-10 max-w-3xl px-4">
          <div className="relative rounded-3xl bg-card p-5 shadow-lift">
            {p.event.logo ? <img src={p.event.logo} alt="" className="mb-3 h-10 w-auto" /> : null}
            <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: p.event.accent }}>
              {p.event.date}
            </div>
            <h1 className="mt-1 text-2xl font-bold leading-tight sm:text-3xl">{p.event.name}</h1>
            {p.event.description ? <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{p.event.description}</p> : null}
            <div className="mt-4">
              {!p.canUpload ? (
                <p className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">Uploads are closed. You can still browse and save photos below.</p>
              ) : joined?.blocked ? (
                <p className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">Uploads from this phone have been turned off by the organiser.</p>
              ) : joined ? (
                <UploadPanel {...p} uploaded={joined.uploaded} onUploaded={gallery.refreshSoon} onNeedJoin={() => setJoined(null)} />
              ) : (
                <JoinForm slug={p.slug} askName={p.event.askName} siteKey={p.siteKey} onJoined={(j) => setJoined({ ...j, blocked: false })} />
              )}
            </div>
          </div>
        </div>
      </header>

      <Gallery slug={p.slug} gallery={gallery} albumDownload={p.albumDownload} />

      {p.event.poweredBy ? (
        <footer className="mt-10 flex justify-center">
          <Link href="/" className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            Powered by <Logo className="text-xs" />
          </Link>
        </footer>
      ) : null}
    </div>
  );
}

function JoinForm({ slug, askName, siteKey, onJoined }: { slug: string; askName: boolean; siteKey: string | null; onJoined: (j: { name: string | null; uploaded: number }) => void }) {
  const [state, run, busy] = useActionState(join.bind(null, slug), {} as JoinState);
  const cb = useRef(onJoined);
  useEffect(() => {
    cb.current = onJoined;
  });
  useEffect(() => {
    if (state.joined) cb.current(state.joined);
  }, [state.joined]);
  return (
    <form action={run} className="grid gap-3">
      {askName ? (
        <label className="grid gap-1.5">
          <span className="text-sm font-semibold">Your name</span>
          <input name="name" maxLength={60} autoComplete="name" placeholder="So everyone knows who took them (optional)" className="h-12 rounded-xl border border-input bg-card px-3 outline-none focus:border-ink" />
        </label>
      ) : null}
      {siteKey ? <Turnstile siteKey={siteKey} /> : null}
      {state.error ? <p className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p> : null}
      <button disabled={busy} className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-6 font-semibold text-white disabled:opacity-60">
        {busy ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <ImagePlus className="size-5" aria-hidden />}
        Start sharing photos
      </button>
    </form>
  );
}

function UploadPanel(p: Props & { uploaded: number; onUploaded: () => void; onNeedJoin: () => void }) {
  const pick = useRef<HTMLInputElement>(null);
  const shoot = useRef<HTMLInputElement>(null);
  const up = useUploader({
    slug: p.slug,
    quality: p.quality,
    maxBytes: p.limits.maxBytes,
    remaining: Math.max(0, p.limits.perGuest - p.uploaded),
    onUploaded: p.onUploaded,
    onNeedJoin: p.onNeedJoin,
  });
  const done = up.items.filter((i) => i.status === "done").length;
  const failed = up.items.filter((i) => i.status === "error").length;
  const onFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) up.add(e.target.files);
    e.target.value = "";
  };
  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => pick.current?.click()}
          disabled={up.remaining <= 0}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-4 font-semibold text-white disabled:opacity-50"
        >
          <ImagePlus className="size-5" aria-hidden /> Add photos
        </button>
        <button
          type="button"
          onClick={() => shoot.current?.click()}
          disabled={up.remaining <= 0}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-border bg-card px-4 font-semibold disabled:opacity-50"
        >
          <Camera className="size-5" aria-hidden /> Take photo
        </button>
      </div>
      <input ref={pick} type="file" accept="image/*" multiple hidden onChange={onFiles} />
      <input ref={shoot} type="file" accept="image/*" capture="environment" hidden onChange={onFiles} />
      <p className="text-center text-xs text-muted-foreground">
        {up.remaining > 0 ? `You can add ${up.remaining} more photo${up.remaining === 1 ? "" : "s"}.` : "You've used all your photos. Thank you for sharing!"}
        {p.event.review ? " Photos appear once the organiser approves them." : ""}
      </p>
      {up.notice ? <p className="rounded-xl bg-warn-soft px-3 py-2 text-sm text-warn">{up.notice}</p> : null}
      {up.items.length ? (
        <div className="grid gap-2 rounded-2xl bg-muted p-3">
          <div className="flex items-center justify-between text-sm font-semibold">
            <span>
              {up.busy ? `Uploading… ${done} of ${up.items.length} done` : `${done} uploaded${failed ? `, ${failed} failed` : ""}`}
            </span>
            {!up.busy ? (
              <button type="button" onClick={up.clearDone} className="text-xs text-muted-foreground underline">
                Clear
              </button>
            ) : null}
          </div>
          {up.busy ? <p className="text-xs text-muted-foreground">Keep this page open until it finishes.</p> : null}
          <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-8">
            {up.items.map((i) => (
              <div key={i.key} className="relative aspect-square overflow-hidden rounded-lg bg-card" title={i.error}>
                <img src={i.preview} alt="" className="size-full object-cover" />
                {i.status === "done" ? (
                  <span className="absolute inset-0 grid place-items-center bg-black/25">
                    <CheckCircle2 className="size-6 text-white" aria-label="Uploaded" />
                  </span>
                ) : i.status === "error" ? (
                  <span className="absolute inset-0 grid place-items-center bg-danger/60">
                    <X className="size-6 text-white" aria-label={i.error ?? "Failed"} />
                  </span>
                ) : (
                  <span className="absolute inset-x-1 bottom-1 h-1.5 overflow-hidden rounded-full bg-white/60">
                    <span className="block h-full bg-[var(--accent)] transition-[width]" style={{ width: `${Math.max(5, i.progress * 100)}%` }} />
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ------------------------------------------------------------------ gallery

type GalleryState = ReturnType<typeof useGallery>;

function useGallery(slug: string, initial: Props["initial"]) {
  const [order, setOrder] = useState<"new" | "old">("new");
  const [photos, setPhotos] = useState(initial.photos);
  const [next, setNext] = useState(initial.next);
  const [count, setCount] = useState(initial.count);
  const [loading, setLoading] = useState(false);
  const latest = useRef(initial.photos[0]?.at ?? null);
  const orderRef = useRef(order);
  useEffect(() => {
    orderRef.current = order;
  }, [order]);

  const load = useCallback(
    async (o: "new" | "old", cursor: string | null, replace: boolean) => {
      setLoading(true);
      try {
        const u = new URLSearchParams({ order: o });
        if (cursor) u.set("cursor", cursor);
        const r = await fetch(`/api/e/${slug}/photos?${u}`);
        if (!r.ok) return;
        const b = (await r.json()) as { photos: GalleryPhoto[]; next: string | null; count: number };
        setPhotos((prev) => (replace ? b.photos : [...prev, ...b.photos.filter((x) => !prev.some((y) => y.id === x.id))]));
        setNext(b.next);
        setCount(b.count);
        if (o === "new" && replace) latest.current = b.photos[0]?.at ?? latest.current;
      } finally {
        setLoading(false);
      }
    },
    [slug],
  );

  const poll = useCallback(async () => {
    if (document.hidden) return;
    const u = new URLSearchParams({ order: "new", limit: "100" });
    if (latest.current) u.set("since", latest.current);
    const r = await fetch(`/api/e/${slug}/photos?${u}`).catch(() => null);
    if (!r?.ok) return;
    const b = (await r.json()) as { photos: GalleryPhoto[]; count: number };
    setCount(b.count);
    if (!b.photos.length) return;
    latest.current = b.photos[0].at;
    setPhotos((prev) => {
      const fresh = b.photos.filter((x) => !prev.some((y) => y.id === x.id));
      return orderRef.current === "new" ? [...fresh, ...prev] : prev;
    });
  }, [slug]);

  useEffect(() => {
    const t = setInterval(poll, 15_000);
    const vis = () => !document.hidden && poll();
    document.addEventListener("visibilitychange", vis);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", vis);
    };
  }, [poll]);

  // After our own upload, the worker needs a few seconds; check a little later.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshSoon = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(poll, 3500);
  }, [poll]);

  const changeOrder = (o: "new" | "old") => {
    if (o === order) return;
    setOrder(o);
    load(o, null, true);
  };

  return { order, changeOrder, photos, next, count, loading, more: () => next && load(order, next, false), reload: () => load(order, null, true), refreshSoon };
}

function Gallery({ slug, gallery: g, albumDownload }: { slug: string; gallery: GalleryState; albumDownload: boolean }) {
  const [open, setOpen] = useState<number | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const { next, loading, more } = g;
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !next) return;
    const io = new IntersectionObserver((ents) => ents[0].isIntersecting && !loading && more(), { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [next, loading, more]);

  return (
    <section className="mx-auto mt-8 max-w-5xl px-2 sm:px-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-2">
        <h2 className="text-lg font-bold">
          {g.count.toLocaleString("en-MY")} photo{g.count === 1 ? "" : "s"}
        </h2>
        <div className="flex items-center gap-2">
          <div className="flex rounded-full bg-muted p-1 text-xs font-semibold">
            {(["new", "old"] as const).map((o) => (
              <button key={o} type="button" onClick={() => g.changeOrder(o)} className={`rounded-full px-3 py-1.5 ${g.order === o ? "bg-card shadow-soft" : "text-muted-foreground"}`}>
                {o === "new" ? "Newest" : "Oldest"}
              </button>
            ))}
          </div>
          <button type="button" onClick={g.reload} className="grid size-8 place-items-center rounded-full bg-muted" aria-label="Refresh">
            <RotateCw className="size-4" aria-hidden />
          </button>
          {albumDownload && g.count > 0 ? (
            <a href={`/api/e/${slug}/album`} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-ink px-3 text-xs font-semibold text-white">
              <Download className="size-3.5" aria-hidden /> Album
            </a>
          ) : null}
        </div>
      </div>
      {g.photos.length === 0 ? (
        <p className="mx-2 rounded-2xl bg-card px-4 py-12 text-center text-sm text-muted-foreground">No photos yet. Be the first to share one!</p>
      ) : (
        <div className="grid grid-cols-3 gap-1 sm:grid-cols-4 lg:grid-cols-5">
          {g.photos.map((ph, i) => (
            <button key={ph.id} type="button" onClick={() => setOpen(i)} className="relative aspect-square overflow-hidden bg-muted sm:rounded-lg">
              <img src={ph.sm} alt={ph.by ? `Photo by ${ph.by}` : "Event photo"} loading="lazy" decoding="async" className="size-full object-cover" />
              {ph.status === "review" ? <span className="absolute left-1 top-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white">Waiting approval</span> : null}
            </button>
          ))}
        </div>
      )}
      <div ref={sentinel} className="h-10" />
      {loading ? <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" aria-label="Loading" /> : null}
      {open !== null ? (
        <Viewer
          slug={slug}
          photos={g.photos}
          index={open}
          onIndex={(i) => {
            setOpen(i);
            if (i >= g.photos.length - 3) g.more();
          }}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </section>
  );
}
