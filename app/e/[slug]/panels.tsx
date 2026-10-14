"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Heart, Loader2, Send, X } from "lucide-react";
import type { GalleryPhoto } from "@/lib/photos";
import type { Gallery } from "./use-gallery";

export type MissionInfo = { id: string; title: string; emoji: string | null; count: number };
export type Snapper = { id: string; name: string | null; count: number };
export type TopPhoto = { id: string; sm: string; md: string; votes: number; by: string | null };
export type WishItem = { id: string; name: string | null; message: string; at: string; photo: string | null };
export type PersonItem = { id: string; name: string | null; count: number; cover: string | null; hearts: number };

// ------------------------------------------------------------------ photo grid

export function PhotoGrid({ gallery, onOpen, missions, empty }: { gallery: Gallery; onOpen: (i: number) => void; missions: Map<string, MissionInfo>; empty: string }) {
  const sentinel = useRef<HTMLDivElement>(null);
  const { next, loading, more, photos } = gallery;
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !next) return;
    const io = new IntersectionObserver((ents) => ents[0].isIntersecting && more(), { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [next, more]);

  if (!photos.length && !loading) return <p className="mx-2 rounded-2xl bg-card px-4 py-12 text-center text-sm text-muted-foreground">{empty}</p>;
  return (
    <>
      <div className="grid grid-cols-3 gap-1 sm:grid-cols-4 lg:grid-cols-5">
        {photos.map((ph, i) => {
          const m = ph.mission ? missions.get(ph.mission) : null;
          return (
            <button key={ph.id} type="button" onClick={() => onOpen(i)} className="relative aspect-square overflow-hidden bg-muted sm:rounded-lg">
              <img src={ph.sm} alt={ph.by ? `Photo by ${ph.by}` : "Event photo"} loading="lazy" decoding="async" className="size-full object-cover" />
              {ph.status === "review" ? <span className="absolute left-1 top-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white">Waiting approval</span> : null}
              {m ? <span className="absolute left-1 top-1 rounded-full bg-black/50 px-1.5 py-0.5 text-[11px]">{m.emoji ?? "🎯"}</span> : null}
              {ph.votes > 0 ? (
                <span className="absolute bottom-1 right-1 inline-flex items-center gap-0.5 rounded-full bg-black/55 px-1.5 py-0.5 text-[11px] font-semibold text-white">
                  <Heart className={`size-3 ${ph.voted ? "fill-[#ff4d6d] text-[#ff4d6d]" : ""}`} aria-hidden /> {ph.votes}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      <div ref={sentinel} className="h-10" />
      {loading ? <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" aria-label="Loading" /> : null}
    </>
  );
}

// ------------------------------------------------------------------ missions

export function MissionsCard({ missions, done, onPick, canShoot }: { missions: MissionInfo[]; done: Set<string>; onPick: (id: string) => void; canShoot: boolean }) {
  if (!missions.length) return null;
  const n = missions.filter((m) => done.has(m.id)).length;
  const all = n === missions.length;
  return (
    <section className="mx-auto mt-5 max-w-3xl px-4">
      <div className="rounded-3xl bg-card p-4 shadow-soft">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-bold">🎯 Snap missions</h2>
          <span className="text-sm font-semibold" style={{ color: "var(--accent)" }}>
            {n}/{missions.length}
          </span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${(n / missions.length) * 100}%`, background: "var(--accent)" }} />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {all ? "All missions complete — you're a legend! 🏆" : canShoot ? "Tap a mission to snap it." : "Uploads are closed — see what everyone captured."}
        </p>
        <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
          {missions.map((m) => {
            const ok = done.has(m.id);
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => onPick(m.id)}
                className={`flex w-36 shrink-0 flex-col items-start gap-1 rounded-2xl border p-3 text-left transition-colors ${ok ? "border-transparent bg-ok-soft" : "border-border bg-background"}`}
              >
                <span className="flex w-full items-center justify-between text-xl">
                  {m.emoji ?? "🎯"}
                  {ok ? (
                    <span className="grid size-5 place-items-center rounded-full bg-ok text-white">
                      <Check className="size-3.5" aria-label="Done" />
                    </span>
                  ) : null}
                </span>
                <span className="line-clamp-2 text-sm font-semibold leading-tight">{m.title}</span>
                <span className="text-[11px] text-muted-foreground">{m.count} photo{m.count === 1 ? "" : "s"}</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ people (folders)

export function PeoplePanel({ slug, onOpen }: { slug: string; onOpen: (p: PersonItem) => void }) {
  const [people, setPeople] = useState<PersonItem[] | null>(null);
  useEffect(() => {
    let live = true;
    fetch(`/api/e/${slug}/people`)
      .then((r) => r.json())
      .then((b: { people: PersonItem[] }) => live && setPeople(b.people))
      .catch(() => live && setPeople([]));
    return () => {
      live = false;
    };
  }, [slug]);
  if (!people) return <Loader2 className="mx-auto mt-8 size-6 animate-spin text-muted-foreground" aria-label="Loading" />;
  if (!people.length) return <p className="mx-2 rounded-2xl bg-card px-4 py-12 text-center text-sm text-muted-foreground">No one has shared yet.</p>;
  return (
    <div className="grid grid-cols-2 gap-3 px-2 sm:grid-cols-3 lg:grid-cols-4">
      {people.map((p) => (
        <button key={p.id} type="button" onClick={() => onOpen(p)} className="overflow-hidden rounded-2xl border border-border bg-card text-left shadow-soft">
          <div className="relative aspect-[4/3] bg-muted">
            {p.cover ? <img src={p.cover} alt="" loading="lazy" className="size-full object-cover" /> : null}
            <span className="absolute bottom-2 left-2 grid size-9 place-items-center rounded-full border-2 border-white text-sm font-bold text-white" style={{ background: "var(--accent)" }}>
              {(p.name ?? "G").trim().charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="p-3">
            <div className="truncate font-semibold">{p.name ?? "Guest"}</div>
            <div className="text-xs text-muted-foreground">
              {p.count} photo{p.count === 1 ? "" : "s"}
              {p.hearts ? ` · ${p.hearts} ❤️` : ""}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ leaderboard

const MEDALS = ["🥇", "🥈", "🥉"];

export function TopPanel({ snappers, gallery, onOpen, missions }: { snappers: Snapper[]; gallery: Gallery; onOpen: (i: number) => void; missions: Map<string, MissionInfo> }) {
  return (
    <div className="grid gap-6">
      <section className="mx-2 rounded-3xl bg-card p-4 shadow-soft">
        <h3 className="font-bold">🏆 Top snappers</h3>
        {snappers.length ? (
          <ol className="mt-3 grid gap-2">
            {snappers.map((s, i) => (
              <li key={s.id} className="flex items-center gap-3 rounded-2xl bg-background px-3 py-2">
                <span className="w-7 text-center text-xl">{MEDALS[i] ?? <span className="text-sm font-bold text-muted-foreground">{i + 1}</span>}</span>
                <span className="min-w-0 flex-1 truncate font-semibold">{s.name ?? "Guest"}</span>
                <span className="text-sm text-muted-foreground">{s.count} 📸</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">The race hasn&apos;t started — be the first!</p>
        )}
      </section>
      <section>
        <h3 className="mb-2 px-2 font-bold">❤️ Most loved photos</h3>
        <PhotoGrid gallery={gallery} onOpen={onOpen} missions={missions} empty="No hearts yet. Open a photo and double-tap to heart it!" />
      </section>
    </div>
  );
}

// ------------------------------------------------------------------ wishes

export function WishesPanel({ slug, onWrite, canWrite, refreshKey }: { slug: string; onWrite: () => void; canWrite: boolean; refreshKey: number }) {
  const [wishes, setWishes] = useState<WishItem[] | null>(null);
  const load = useCallback(async () => {
    const r = await fetch(`/api/e/${slug}/wishes`).catch(() => null);
    if (r?.ok) setWishes(((await r.json()) as { wishes: WishItem[] }).wishes);
  }, [slug]);
  useEffect(() => {
    const first = setTimeout(load, 0);
    const t = setInterval(() => !document.hidden && load(), 30_000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [load, refreshKey]);
  return (
    <div className="grid gap-3 px-2">
      {canWrite ? (
        <button type="button" onClick={onWrite} className="flex items-center gap-3 rounded-2xl border border-dashed border-border bg-card p-4 text-left text-muted-foreground">
          <span className="text-2xl">💌</span>
          <span>Write a wish for the hosts…</span>
        </button>
      ) : null}
      {!wishes ? (
        <Loader2 className="mx-auto mt-6 size-6 animate-spin text-muted-foreground" aria-label="Loading" />
      ) : !wishes.length ? (
        <p className="rounded-2xl bg-card px-4 py-10 text-center text-sm text-muted-foreground">No wishes yet. Be the first to say something lovely!</p>
      ) : (
        <div className="columns-1 gap-3 sm:columns-2">
          {wishes.map((w) => (
            <article key={w.id} className="mb-3 break-inside-avoid rounded-2xl bg-card p-4 shadow-soft">
              {w.photo ? <img src={w.photo} alt="" loading="lazy" className="mb-3 aspect-[4/3] w-full rounded-xl object-cover" /> : null}
              <p className="whitespace-pre-line text-[15px] leading-relaxed">{w.message}</p>
              <div className="mt-2 text-xs font-semibold" style={{ color: "var(--accent)" }}>
                — {w.name ?? "A guest"}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ sheets

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-md rounded-t-3xl bg-card p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-lift sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button type="button" onClick={onClose} className="grid size-9 place-items-center rounded-full bg-muted" aria-label="Close">
            <X className="size-5" aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function WishForm({ slug, myPhotos, onDone }: { slug: string; myPhotos: GalleryPhoto[]; onDone: () => void }) {
  const [message, setMessage] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/e/${slug}/wishes`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message, photo }) });
      const b = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) return setError(b.error ?? "Couldn't send. Try again.");
      setMessage("");
      setPhoto(null);
      onDone();
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="grid gap-3">
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        maxLength={500}
        rows={4}
        autoFocus
        placeholder="Congratulations! Wishing you both a lifetime of happiness…"
        className="w-full rounded-2xl border border-input bg-background px-3 py-2 outline-none focus:border-ink"
      />
      {myPhotos.length ? (
        <div>
          <div className="mb-1.5 text-xs font-semibold text-muted-foreground">Add one of your photos (optional)</div>
          <div className="no-scrollbar flex gap-2 overflow-x-auto">
            {myPhotos.slice(0, 20).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPhoto((x) => (x === p.id ? null : p.id))}
                className={`relative size-16 shrink-0 overflow-hidden rounded-xl border-2 ${photo === p.id ? "border-[var(--accent)]" : "border-transparent"}`}
              >
                <img src={p.sm} alt="" className="size-full object-cover" />
                {photo === p.id ? (
                  <span className="absolute inset-0 grid place-items-center bg-black/30">
                    <Check className="size-5 text-white" aria-hidden />
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {error ? <p className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p> : null}
      <button
        type="button"
        onClick={send}
        disabled={busy || message.trim().length < 2}
        className="inline-flex h-12 items-center justify-center gap-2 rounded-full font-semibold text-white disabled:opacity-50"
        style={{ background: "var(--accent)" }}
      >
        {busy ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Send className="size-5" aria-hidden />} Send wish
      </button>
    </div>
  );
}
