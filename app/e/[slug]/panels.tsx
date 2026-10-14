"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Check, CloudUpload, Heart, Loader2, Send, X } from "lucide-react";
import type { GalleryPhoto } from "@/lib/photos";
import type { Gallery } from "./use-gallery";

export type MissionInfo = { id: string; title: string; emoji: string | null; count: number; cover?: string | null };
export type Snapper = { id: string; name: string | null; count: number };
export type TopPhoto = { id: string; sm: string; md: string; votes: number; by: string | null };
export type WishItem = { id: string; name: string | null; message: string; at: string; photo: string | null };
export type PersonItem = { id: string; name: string | null; count: number; cover: string | null; hearts: number };

export const initial = (name: string | null) => (name ?? "G").trim().charAt(0).toUpperCase() || "G";

// ------------------------------------------------------------------ masonry grid

export function Masonry({ gallery, onOpen, missions, empty }: { gallery: Gallery; onOpen: (i: number) => void; missions: Map<string, MissionInfo>; empty: string }) {
  const sentinel = useRef<HTMLDivElement>(null);
  const { next, loading, more, photos } = gallery;
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !next) return;
    const io = new IntersectionObserver((ents) => ents[0].isIntersecting && more(), { rootMargin: "800px" });
    io.observe(el);
    return () => io.disconnect();
  }, [next, more]);

  if (!photos.length && !loading) return <p className="mx-2 rounded-3xl bg-white px-4 py-14 text-center text-sm text-muted-foreground shadow-soft">{empty}</p>;
  return (
    <>
      <div className="columns-2 gap-2 px-2 sm:columns-3 lg:columns-4">
        {photos.map((ph, i) => {
          const m = ph.mission ? missions.get(ph.mission) : null;
          return (
            <button
              key={ph.id}
              type="button"
              onClick={() => onOpen(i)}
              className="relative mb-2 block w-full break-inside-avoid overflow-hidden rounded-2xl bg-muted [animation:pc-rise_0.45s_ease_both]"
              style={{ aspectRatio: `${ph.w || 3} / ${ph.h || 4}` }}
            >
              <img src={ph.sm} alt={ph.by ? `Photo by ${ph.by}` : "Event photo"} loading="lazy" decoding="async" className="size-full object-cover" />
              {ph.status === "review" ? <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">Waiting approval</span> : null}
              {m ? <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-xs shadow-soft">{m.emoji ?? "🎯"}</span> : null}
              {ph.votes > 0 ? (
                <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur">
                  <Heart className={`size-3 ${ph.voted ? "fill-brand text-brand" : ""}`} aria-hidden /> {ph.votes}
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

// ------------------------------------------------------------------ highlights

export function AlbumCard({ title, subtitle, cover, emoji, onClick, tall }: { title: string; subtitle: string; cover: string | null; emoji?: string | null; onClick: () => void; tall?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={`group relative block w-full overflow-hidden rounded-3xl bg-ink text-left shadow-soft ${tall ? "aspect-[16/9]" : "aspect-[4/5] sm:aspect-[16/11]"}`}>
      {cover ? (
        <img src={cover} alt="" loading="lazy" className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-105" />
      ) : (
        <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-brand to-[#ff7a93] text-5xl">{emoji ?? "🎯"}</div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-4 text-white">
        <div className="min-w-0">
          <div className="truncate text-lg font-bold leading-tight">
            {emoji ? `${emoji} ` : ""}
            {title}
          </div>
          <div className="text-sm text-white/80">{subtitle}</div>
        </div>
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white text-ink">
          <ArrowRight className="size-4" aria-hidden />
        </span>
      </div>
    </button>
  );
}

const MEDALS = ["🥇", "🥈", "🥉"];

export function TopSnappers({ snappers }: { snappers: Snapper[] }) {
  if (!snappers.length) return null;
  return (
    <section className="rounded-3xl bg-white p-4 shadow-soft">
      <h3 className="font-bold">🏆 Top snappers</h3>
      <ol className="mt-3 grid gap-2">
        {snappers.map((s, i) => (
          <li key={s.id} className="flex items-center gap-3 rounded-2xl bg-background px-3 py-2">
            <span className="w-7 text-center text-xl">{MEDALS[i] ?? <span className="text-sm font-bold text-muted-foreground">{i + 1}</span>}</span>
            <span className="min-w-0 flex-1 truncate font-semibold">{s.name ?? "Guest"}</span>
            <span className="text-sm text-muted-foreground">{s.count} 📸</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function MissionsProgress({ missions, done, onPick, canShoot }: { missions: MissionInfo[]; done: Set<string>; onPick: (id: string) => void; canShoot: boolean }) {
  if (!missions.length) return null;
  const n = missions.filter((m) => done.has(m.id)).length;
  return (
    <section className="rounded-3xl bg-white p-4 shadow-soft">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-bold">🎯 Snap missions</h2>
        <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-sm font-bold text-brand">
          {n}/{missions.length}
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-brand transition-[width] duration-700" style={{ width: `${(n / missions.length) * 100}%` }} />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{n === missions.length ? "All missions complete — legend! 🏆" : canShoot ? "Tap a mission to snap it." : "See what everyone captured."}</p>
      <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
        {missions.map((m) => {
          const ok = done.has(m.id);
          return (
            <button key={m.id} type="button" onClick={() => onPick(m.id)} className={`flex w-32 shrink-0 flex-col items-start gap-1 rounded-2xl border p-3 text-left ${ok ? "border-transparent bg-ok-soft" : "border-border bg-background"}`}>
              <span className="flex w-full items-center justify-between text-xl">
                {m.emoji ?? "🎯"}
                {ok ? (
                  <span className="grid size-5 place-items-center rounded-full bg-ok text-white">
                    <Check className="size-3.5" aria-label="Done" />
                  </span>
                ) : null}
              </span>
              <span className="line-clamp-2 text-[13px] font-semibold leading-tight">{m.title}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ people

export function usePeople(slug: string, refreshKey: number) {
  const [people, setPeople] = useState<PersonItem[] | null>(null);
  useEffect(() => {
    let live = true;
    const t = setTimeout(() => {
      fetch(`/api/e/${slug}/people`)
        .then((r) => r.json())
        .then((b: { people: PersonItem[] }) => live && setPeople(b.people))
        .catch(() => live && setPeople([]));
    }, 0);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [slug, refreshKey]);
  return people;
}

export function Avatar({ person, size = "md" }: { person: Pick<PersonItem, "name" | "cover">; size?: "md" | "lg" }) {
  const cls = size === "lg" ? "size-20 text-2xl" : "size-16 text-lg";
  return person.cover ? (
    <img src={person.cover} alt="" className={`${cls} rounded-full border-2 border-white object-cover shadow-soft`} />
  ) : (
    <span className={`${cls} grid place-items-center rounded-full bg-brand font-bold text-white shadow-soft`}>{initial(person.name)}</span>
  );
}

export function PeopleRow({ people, onOpen }: { people: PersonItem[]; onOpen: (p: PersonItem) => void }) {
  if (!people.length) return null;
  return (
    <div className="no-scrollbar -mx-4 flex gap-4 overflow-x-auto px-4 pb-1">
      {people.slice(0, 20).map((p) => (
        <button key={p.id} type="button" onClick={() => onOpen(p)} className="grid w-20 shrink-0 justify-items-center gap-1 text-center">
          <Avatar person={p} />
          <span className="w-full truncate text-sm font-semibold">{p.name ?? "Guest"}</span>
          <span className="text-[11px] text-muted-foreground">
            {p.count} photo{p.count === 1 ? "" : "s"}
          </span>
        </button>
      ))}
    </div>
  );
}

export function PeopleGrid({ people, onOpen }: { people: PersonItem[] | null; onOpen: (p: PersonItem) => void }) {
  if (!people) return <Loader2 className="mx-auto mt-8 size-6 animate-spin text-muted-foreground" aria-label="Loading" />;
  if (!people.length) return <p className="rounded-3xl bg-white px-4 py-12 text-center text-sm text-muted-foreground shadow-soft">No one has shared yet.</p>;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {people.map((p) => (
        <button key={p.id} type="button" onClick={() => onOpen(p)} className="grid justify-items-center gap-2 rounded-3xl bg-white p-4 text-center shadow-soft [animation:pc-rise_0.4s_ease_both]">
          <Avatar person={p} size="lg" />
          <span className="w-full truncate font-bold">{p.name ?? "Guest"}</span>
          <span className="text-xs text-muted-foreground">
            {p.count} photo{p.count === 1 ? "" : "s"}
            {p.hearts ? ` · ${p.hearts} ❤️` : ""}
          </span>
        </button>
      ))}
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
    <div className="grid gap-3">
      {canWrite ? (
        <button type="button" onClick={onWrite} className="flex items-center gap-3 rounded-3xl border-2 border-dashed border-brand/30 bg-brand-soft/50 p-4 text-left text-ink/70">
          <span className="text-2xl">💌</span>
          <span className="font-medium">Write a wish for the hosts…</span>
        </button>
      ) : null}
      {!wishes ? (
        <Loader2 className="mx-auto mt-6 size-6 animate-spin text-muted-foreground" aria-label="Loading" />
      ) : !wishes.length ? (
        <p className="rounded-3xl bg-white px-4 py-10 text-center text-sm text-muted-foreground shadow-soft">No wishes yet. Be the first to say something lovely!</p>
      ) : (
        <div className="columns-1 gap-3 sm:columns-2">
          {wishes.map((w, i) => (
            <article key={w.id} className={`mb-3 break-inside-avoid rounded-3xl bg-white p-4 shadow-soft [animation:pc-rise_0.4s_ease_both] ${i % 3 === 1 ? "rotate-[0.6deg]" : i % 3 === 2 ? "-rotate-[0.6deg]" : ""}`}>
              {w.photo ? <img src={w.photo} alt="" loading="lazy" className="mb-3 aspect-[4/3] w-full rounded-2xl object-cover" /> : null}
              <p className="whitespace-pre-line font-script text-2xl leading-snug text-ink">{w.message}</p>
              <div className="mt-2 text-xs font-semibold text-brand">— {w.name ?? "A guest"}</div>
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-[2px] sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-[2rem] bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-lift [animation:pc-rise_0.3s_ease] sm:rounded-[2rem]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-muted sm:hidden" />
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

/** Review step before gallery uploads: see the picks, drop any, then share. */
export function UploadReview({
  files,
  onRemove,
  onAdd,
  onShare,
  missions,
  mission,
  onMission,
  left,
  tags,
}: {
  tags?: { suggested: string[]; value: string[]; onChange: (t: string[]) => void } | null;
  files: { key: string; url: string }[];
  onRemove: (key: string) => void;
  onAdd: () => void;
  onShare: () => void;
  missions: MissionInfo[];
  mission: string | null;
  onMission: (id: string | null) => void;
  left: number;
}) {
  const over = files.length > left;
  return (
    <div className="grid gap-4">
      <button type="button" onClick={onAdd} className="grid place-items-center gap-1 rounded-3xl border-2 border-dashed border-brand/40 bg-brand-soft/60 px-4 py-6 text-center">
        <CloudUpload className="size-8 text-brand" aria-hidden />
        <span className="text-sm font-semibold">Tap to add more photos</span>
        <span className="text-xs text-muted-foreground">or remove any you don&apos;t want to share</span>
      </button>
      <div className="grid grid-cols-3 gap-2">
        {files.map((f) => (
          <div key={f.key} className="relative aspect-square overflow-hidden rounded-2xl bg-muted">
            <img src={f.url} alt="" className="size-full object-cover" />
            <button type="button" onClick={() => onRemove(f.key)} className="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-full bg-black/60 text-white" aria-label="Remove photo">
              <X className="size-4" aria-hidden />
            </button>
          </div>
        ))}
      </div>
      {missions.length ? (
        <div>
          <div className="mb-1.5 text-xs font-semibold text-muted-foreground">Part of a mission? (optional)</div>
          <div className="no-scrollbar flex gap-2 overflow-x-auto">
            <button type="button" onClick={() => onMission(null)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${mission ? "bg-muted" : "bg-ink text-white"}`}>
              None
            </button>
            {missions.map((m) => (
              <button key={m.id} type="button" onClick={() => onMission(m.id)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${mission === m.id ? "bg-brand text-white" : "bg-muted"}`}>
                {m.emoji ?? "🎯"} {m.title}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {tags ? (
        <div>
          <div className="mb-1.5 text-xs font-semibold text-muted-foreground">Add hashtags (optional) — they become albums in Highlights</div>
          <TagPicker suggested={tags.suggested} value={tags.value} onChange={tags.onChange} />
        </div>
      ) : null}
      {over ? <p className="rounded-xl bg-warn-soft px-3 py-2 text-sm text-warn">You have {left} shot{left === 1 ? "" : "s"} left, so only the first {left} will be shared.</p> : null}
      <button type="button" onClick={onShare} disabled={!files.length || left <= 0} className="inline-flex h-13 items-center justify-center gap-2 rounded-full bg-brand py-3.5 font-bold text-white shadow-cherry disabled:opacity-50">
        <Check className="size-5" aria-hidden /> Share {Math.min(files.length, left)} photo{Math.min(files.length, left) === 1 ? "" : "s"}
      </button>
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
        className="w-full rounded-2xl border border-input bg-background px-4 py-3 font-script text-2xl leading-snug outline-none focus:border-brand"
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
                className={`relative size-16 shrink-0 overflow-hidden rounded-xl border-2 ${photo === p.id ? "border-brand" : "border-transparent"}`}
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
      <button type="button" onClick={send} disabled={busy || message.trim().length < 2} className="inline-flex items-center justify-center gap-2 rounded-full bg-brand py-3.5 font-bold text-white shadow-cherry disabled:opacity-50">
        {busy ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Send className="size-5" aria-hidden />} Send wish
      </button>
    </div>
  );
}

// ------------------------------------------------------------------ hashtags

/** One-tap hashtag chips (+ type your own). `dark` for the camera. */
export function TagPicker({ suggested, value, onChange, dark }: { suggested: string[]; value: string[]; onChange: (tags: string[]) => void; dark?: boolean }) {
  const [draft, setDraft] = useState("");
  const all = [...new Set([...suggested, ...value])];
  const toggle = (t: string) => onChange(value.includes(t) ? value.filter((x) => x !== t) : value.length >= 5 ? value : [...value, t]);
  const add = () => {
    const t = draft.trim().replace(/^#+/, "").toLowerCase().replace(/[^a-z0-9_]+/g, "").slice(0, 24);
    if (t.length >= 2 && !value.includes(t) && value.length < 5) onChange([...value, t]);
    setDraft("");
  };
  return (
    <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1" aria-label="Hashtags">
      {all.map((t) => {
        const on = value.includes(t);
        return (
          <button
            key={t}
            type="button"
            onClick={() => toggle(t)}
            aria-pressed={on}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${on ? "bg-brand text-white" : dark ? "bg-white/12 text-white/85" : "bg-muted text-ink/80"}`}
          >
            #{t}
          </button>
        );
      })}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " " || e.key === ",") {
            e.preventDefault();
            add();
          }
        }}
        onBlur={add}
        placeholder="+ your own"
        aria-label="Add your own hashtag"
        className={`w-28 shrink-0 rounded-full px-3 py-1.5 text-xs outline-none ${dark ? "bg-white/10 text-white placeholder:text-white/50" : "bg-muted placeholder:text-muted-foreground"}`}
      />
    </div>
  );
}
