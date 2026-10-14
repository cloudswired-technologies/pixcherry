"use client";

import Link from "next/link";
import { useActionState, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import confetti from "canvas-confetti";
import { Camera, CheckCircle2, Download, ImagePlus, Loader2, MessageCircleHeart, RotateCw, X } from "lucide-react";
import { Turnstile } from "@/components/turnstile";
import { Logo } from "@/components/ui";
import type { Quality } from "@/lib/client/compress";
import { useUploader } from "@/lib/client/uploader";
import type { GalleryPhoto } from "@/lib/photos";
import { join, type JoinState } from "./actions";
import { DisposableCamera } from "./camera";
import { MissionsCard, PeoplePanel, PhotoGrid, Sheet, TopPanel, WishForm, WishesPanel, type MissionInfo, type PersonItem, type Snapper } from "./panels";
import { useGallery, type GalleryFilter } from "./use-gallery";
import { Viewer } from "./viewer";

type Features = { camera: boolean; wishes: boolean; voting: boolean; missions: boolean; albumDownload: boolean };

type Props = {
  slug: string;
  event: { name: string; description: string; date: string; cover: string | null; logo: string | null; accent: string; poweredBy: boolean; askName: boolean; review: boolean; cameraOnly: boolean };
  features: Features;
  canUpload: boolean;
  guest: { name: string | null; uploaded: number; blocked: boolean } | null;
  limits: { perGuest: number; maxBytes: number };
  quality: Quality;
  initial: { photos: GalleryPhoto[]; next: string | null; count: number };
  missions: MissionInfo[];
  missionsDone: string[];
  siteKey: string | null;
};

type Tab = "gallery" | "people" | "top" | "wishes";
type Pending = { kind: "camera" | "upload" | "wish" | "join"; mission?: string | null } | null;
type Stats = { photos: number; guests: number; wishes: number; topSnappers: Snapper[]; missions: MissionInfo[]; missionsDone: string[] };

export function GuestApp(p: Props) {
  const [joined, setJoined] = useState(p.guest);
  const [tab, setTab] = useState<Tab>("gallery");
  const [filter, setFilter] = useState<GalleryFilter>({ order: "new", guest: null, mission: null });
  const [folderName, setFolderName] = useState<string | null>(null);
  const [open, setOpen] = useState<{ list: "gallery" | "top"; i: number } | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [mission, setMission] = useState<string | null>(null);
  const [joinFor, setJoinFor] = useState<Pending>(null);
  const [wishOpen, setWishOpen] = useState(false);
  const [wishKey, setWishKey] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats>({ photos: p.initial.count, guests: 0, wishes: 0, topSnappers: [], missions: p.missions, missionsDone: p.missionsDone });
  const pick = useRef<HTMLInputElement>(null);
  const statsRef = useRef(p.initial.count);
  const pickMission = useRef<string | null>(null);
  const f = p.features;
  const style = { "--accent": p.event.accent } as CSSProperties;

  const gallery = useGallery(p.slug, filter, { photos: p.initial.photos, next: p.initial.next });
  const top = useGallery(p.slug, { order: "top", guest: null, mission: null });
  const missionMap = useMemo(() => new Map(stats.missions.map((m) => [m.id, m])), [stats.missions]);
  const done = useMemo(() => new Set(stats.missionsDone), [stats.missionsDone]);

  const loadStats = useCallback(async () => {
    const r = await fetch(`/api/e/${p.slug}/stats`).catch(() => null);
    if (!r?.ok) return;
    const st = (await r.json()) as Stats;
    statsRef.current = st.photos;
    setStats(st);
  }, [p.slug]);
  useEffect(() => {
    const first = setTimeout(loadStats, 0);
    const t = setInterval(() => !document.hidden && loadStats(), 20_000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [loadStats]);

  const up = useUploader({
    slug: p.slug,
    quality: p.quality,
    maxBytes: p.limits.maxBytes,
    remaining: Math.max(0, p.limits.perGuest - (joined?.uploaded ?? 0)),
    onUploaded: () => {
      gallery.refreshSoon();
      setTimeout(loadStats, 4000);
    },
    onNeedJoin: () => {
      // Session lost (e.g. cookie cleared): ask them to join again instead of leaving them stuck.
      setJoined(null);
      setJoinFor({ kind: "upload" });
    },
    onIdle: (ok) => {
      if (!ok) return;
      confetti({ particleCount: 90, spread: 70, origin: { y: 0.85 }, colors: [p.event.accent, "#ffd166", "#ffffff", "#06d6a0"], disableForReducedMotion: true });
      setToast(ok === 1 ? `Shared! You're snap #${statsRef.current + 1} at this event 🎉` : `${ok} photos shared! 🎉`);
      setTimeout(() => setToast(null), 3500);
    },
  });

  // ---- actions (join first when needed)
  const canShoot = p.canUpload && !joined?.blocked;
  const start = useCallback(
    (kind: "camera" | "upload" | "wish", m: string | null = null) => {
      if (!joined) return setJoinFor({ kind, mission: m });
      if (kind === "wish") return setWishOpen(true);
      if (kind === "camera" && f.camera) {
        setMission(m);
        return setCameraOpen(true);
      }
      pickMission.current = m;
      pick.current?.click();
    },
    [joined, f.camera],
  );

  const onJoined = useCallback(
    (g: { name: string | null; uploaded: number }) => {
      setJoined({ ...g, blocked: false });
      const next = joinFor;
      setJoinFor(null);
      if (!next || next.kind === "join") return;
      setTimeout(() => {
        if (next.kind === "wish") setWishOpen(true);
        else if (next.kind === "camera" && f.camera) {
          setMission(next.mission ?? null);
          setCameraOpen(true);
        } else {
          // A file picker opened from a timer (not a tap) is blocked on iOS: ask for one more tap.
          setToast("You're in! Tap Upload to pick your photos 📸");
          setTimeout(() => setToast(null), 3500);
        }
      }, 50);
    },
    [joinFor, f.camera],
  );

  const vote = useCallback(
    async (ph: GalleryPhoto) => {
      if (!joined) return setJoinFor({ kind: "join" });
      const optimistic = { voted: !ph.voted, votes: ph.votes + (ph.voted ? -1 : 1) };
      gallery.patchPhoto(ph.id, optimistic);
      top.patchPhoto(ph.id, optimistic);
      const r = await fetch(`/api/e/${p.slug}/photos/${ph.id}/vote`, { method: "POST" }).catch(() => null);
      if (r?.ok) {
        const b = (await r.json()) as { voted: boolean; votes: number };
        gallery.patchPhoto(ph.id, b);
        top.patchPhoto(ph.id, b);
      } else {
        gallery.patchPhoto(ph.id, { voted: ph.voted, votes: ph.votes });
        top.patchPhoto(ph.id, { voted: ph.voted, votes: ph.votes });
      }
    },
    [joined, gallery, top, p.slug],
  );

  const openFolder = useCallback((guest: string, name: string | null) => {
    setOpen(null);
    setFolderName(name ?? "Guest");
    setFilter({ order: "new", guest, mission: null });
    setTab("gallery");
    window.scrollTo({ top: document.getElementById("tabs")?.offsetTop ?? 0, behavior: "smooth" });
  }, []);

  const shotsLeft = up.available;
  const myPhotos = gallery.photos.filter((x) => x.mine);
  const viewerList = open?.list === "top" ? top.photos : gallery.photos;
  const tabs: { id: Tab; label: string; show: boolean }[] = [
    { id: "gallery", label: "Gallery", show: true },
    { id: "people", label: "People", show: true },
    { id: "top", label: "Top", show: f.voting },
    { id: "wishes", label: `Wishes${stats.wishes ? ` · ${stats.wishes}` : ""}`, show: f.wishes },
  ];
  const actions = canShoot || (f.wishes && !joined?.blocked);

  return (
    <div style={style} className={`min-h-dvh ${actions ? "pb-28" : "pb-12"}`}>
      {/* ---------------------------------------------------------------- hero */}
      <header className="relative">
        {p.event.cover ? (
          <div className="relative h-52 sm:h-72">
            <img src={p.event.cover} alt="" className="size-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          </div>
        ) : (
          <div className="h-24" style={{ background: `linear-gradient(135deg, ${p.event.accent}, ${p.event.accent}99)` }} />
        )}
        <div className="mx-auto -mt-12 max-w-3xl px-4">
          <div className="relative rounded-3xl bg-card p-5 shadow-lift">
            {p.event.logo ? <img src={p.event.logo} alt="" className="mb-3 h-10 w-auto" /> : null}
            <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: p.event.accent }}>
              {p.event.date}
            </div>
            <h1 className="mt-1 text-2xl font-bold leading-tight sm:text-3xl">{p.event.name}</h1>
            {p.event.description ? <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{p.event.description}</p> : null}
            <div className="mt-4 flex flex-wrap gap-2 text-sm">
              <span className="rounded-full bg-muted px-3 py-1 font-semibold">📸 {stats.photos.toLocaleString("en-MY")}</span>
              {stats.guests ? <span className="rounded-full bg-muted px-3 py-1 font-semibold">👥 {stats.guests}</span> : null}
              {f.wishes && stats.wishes ? <span className="rounded-full bg-muted px-3 py-1 font-semibold">💌 {stats.wishes}</span> : null}
            </div>
            {joined ? (
              <p className="mt-4 text-sm">
                Hi <strong>{joined.name ?? "there"}</strong> 👋{" "}
                {canShoot ? (
                  <span className="text-muted-foreground">
                    You have <strong className="text-foreground">{shotsLeft}</strong> shot{shotsLeft === 1 ? "" : "s"} left.
                  </span>
                ) : null}
              </p>
            ) : !p.canUpload ? (
              <p className="mt-4 rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">Uploads are closed. You can still browse and save photos below.</p>
            ) : null}
            {joined?.blocked ? <p className="mt-3 rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">Uploads from this phone have been turned off by the organiser.</p> : null}
            {p.event.review && canShoot ? <p className="mt-2 text-xs text-muted-foreground">Photos appear once the organiser approves them.</p> : null}
          </div>
        </div>
      </header>

      {f.missions ? <MissionsCard missions={stats.missions} done={done} canShoot={canShoot} onPick={(id) => (canShoot ? start(f.camera ? "camera" : "upload", id) : (setFilter({ order: "new", guest: null, mission: id }), setTab("gallery")))} /> : null}

      {/* ---------------------------------------------------------------- upload tray */}
      {up.items.length || up.notice ? (
        <section className="mx-auto mt-4 max-w-3xl px-4">
          {up.notice ? <p className="mb-2 rounded-xl bg-warn-soft px-3 py-2 text-sm text-warn">{up.notice}</p> : null}
          {up.items.length ? (
            <div className="grid gap-2 rounded-2xl bg-card p-3 shadow-soft">
              <div className="flex items-center justify-between text-sm font-semibold">
                <span>{up.busy ? `Uploading… ${up.items.filter((i) => i.status === "done").length} of ${up.items.length}` : `${up.items.filter((i) => i.status === "done").length} shared`}</span>
                {!up.busy ? (
                  <button type="button" onClick={up.clearDone} className="text-xs text-muted-foreground underline">
                    Clear
                  </button>
                ) : null}
              </div>
              <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
                {up.items.map((i) => (
                  <div key={i.key} className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-muted" title={i.error}>
                    <img src={i.preview} alt="" className="size-full object-cover" />
                    {i.status === "done" ? (
                      <span className="absolute inset-0 grid place-items-center bg-black/25">
                        <CheckCircle2 className="size-5 text-white" aria-label="Uploaded" />
                      </span>
                    ) : i.status === "error" ? (
                      <span className="absolute inset-0 grid place-items-center bg-danger/60">
                        <X className="size-5 text-white" aria-label={i.error ?? "Failed"} />
                      </span>
                    ) : (
                      <span className="absolute inset-x-1 bottom-1 h-1.5 overflow-hidden rounded-full bg-white/60">
                        <span className="block h-full bg-[var(--accent)] transition-[width]" style={{ width: `${Math.max(5, i.progress * 100)}%` }} />
                      </span>
                    )}
                  </div>
                ))}
              </div>
              {up.busy ? <p className="text-xs text-muted-foreground">Keep this page open until it finishes.</p> : null}
            </div>
          ) : null}
        </section>
      ) : null}

      {/* ---------------------------------------------------------------- tabs */}
      <nav id="tabs" className="sticky top-0 z-20 mt-6 border-b border-border bg-background/90 backdrop-blur">
        <div className="no-scrollbar mx-auto flex max-w-5xl gap-1 overflow-x-auto px-3">
          {tabs
            .filter((t) => t.show)
            .map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`-mb-px shrink-0 border-b-2 px-3 py-3 text-sm font-semibold ${tab === t.id ? "border-[var(--accent)] text-foreground" : "border-transparent text-muted-foreground"}`}
              >
                {t.label}
              </button>
            ))}
        </div>
      </nav>

      <main className="mx-auto mt-4 max-w-5xl px-2 sm:px-4">
        {tab === "gallery" ? (
          <>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-2">
              {filter.guest || filter.mission ? (
                <button type="button" onClick={() => (setFilter({ order: "new", guest: null, mission: null }), setFolderName(null))} className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-white">
                  {filter.guest ? `📁 ${folderName}` : `${missionMap.get(filter.mission!)?.emoji ?? "🎯"} ${missionMap.get(filter.mission!)?.title ?? "Mission"}`}
                  <X className="size-3.5" aria-label="Clear filter" />
                </button>
              ) : (
                <div className="flex rounded-full bg-muted p-1 text-xs font-semibold">
                  {(["new", "old"] as const).map((o) => (
                    <button key={o} type="button" onClick={() => setFilter((x) => ({ ...x, order: o }))} className={`rounded-full px-3 py-1.5 ${filter.order === o ? "bg-card shadow-soft" : "text-muted-foreground"}`}>
                      {o === "new" ? "Newest" : "Oldest"}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2">
                <button type="button" onClick={gallery.reload} className="grid size-8 place-items-center rounded-full bg-muted" aria-label="Refresh">
                  <RotateCw className="size-4" aria-hidden />
                </button>
                {f.albumDownload && stats.photos > 0 ? (
                  <a href={`/api/e/${p.slug}/album`} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-ink px-3 text-xs font-semibold text-white">
                    <Download className="size-3.5" aria-hidden /> Album
                  </a>
                ) : null}
              </div>
            </div>
            <PhotoGrid gallery={gallery} missions={missionMap} onOpen={(i) => setOpen({ list: "gallery", i })} empty={filter.guest || filter.mission ? "Nothing here yet." : "No photos yet. Be the first to snap one!"} />
          </>
        ) : tab === "people" ? (
          <PeoplePanel slug={p.slug} onOpen={(x: PersonItem) => openFolder(x.id, x.name)} />
        ) : tab === "top" ? (
          <TopPanel snappers={stats.topSnappers} gallery={top} missions={missionMap} onOpen={(i) => setOpen({ list: "top", i })} />
        ) : (
          <WishesPanel slug={p.slug} canWrite={!joined?.blocked} onWrite={() => start("wish")} refreshKey={wishKey} />
        )}
      </main>

      {p.event.poweredBy ? (
        <footer className="mt-10 flex justify-center">
          <Link href="/" className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            Powered by <Logo className="text-xs" />
          </Link>
        </footer>
      ) : null}

      {/* ---------------------------------------------------------------- action bar */}
      {actions ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
          <div className="mx-auto flex max-w-md gap-2">
            {canShoot && f.camera ? (
              <button type="button" onClick={() => start("camera")} disabled={!!joined && shotsLeft <= 0} className="inline-flex h-12 flex-[1.4] items-center justify-center gap-2 rounded-full font-semibold text-white disabled:opacity-50" style={{ background: p.event.accent }}>
                <Camera className="size-5" aria-hidden /> Camera
              </button>
            ) : null}
            {canShoot && !(f.camera && p.event.cameraOnly) ? (
              <button
                type="button"
                onClick={() => start("upload")}
                disabled={!!joined && shotsLeft <= 0}
                className={`inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full font-semibold disabled:opacity-50 ${f.camera ? "border border-border bg-card" : "text-white"}`}
                style={f.camera ? undefined : { background: p.event.accent }}
              >
                <ImagePlus className="size-5" aria-hidden /> Upload
              </button>
            ) : null}
            {f.wishes && !joined?.blocked ? (
              <button type="button" onClick={() => start("wish")} className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full border border-border bg-card font-semibold" aria-label="Write a wish">
                <MessageCircleHeart className="size-5" aria-hidden /> Wish
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <input
        ref={pick}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files?.length) up.add(e.target.files, { mission: pickMission.current });
          pickMission.current = null;
          e.target.value = "";
        }}
      />

      {toast ? (
        <div className="fixed inset-x-0 bottom-28 z-40 flex justify-center px-4" role="status">
          <div className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white shadow-lift [animation:pc-pop_3.5s_ease_forwards]">{toast}</div>
        </div>
      ) : null}

      {cameraOpen ? <DisposableCamera
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onShot={(file) => up.add([file], { mission, prepared: true })}
        onFallback={() => {
          setCameraOpen(false);
          pickMission.current = mission;
          pick.current?.click();
        }}
        shotsLeft={shotsLeft}
        quality={p.quality}
        maxBytes={p.limits.maxBytes}
        missions={f.missions ? stats.missions : []}
        mission={mission}
        onMission={setMission}
        accent={p.event.accent}
      /> : null}

      <Sheet open={!!joinFor} onClose={() => setJoinFor(null)} title="Join the album">
        <JoinForm slug={p.slug} askName={p.event.askName} siteKey={p.siteKey} onJoined={onJoined} canUpload={p.canUpload} />
      </Sheet>

      <Sheet open={wishOpen} onClose={() => setWishOpen(false)} title="💌 Write a wish">
        <WishForm
          slug={p.slug}
          myPhotos={myPhotos}
          onDone={() => {
            setWishOpen(false);
            setWishKey((k) => k + 1);
            setTab("wishes");
            loadStats();
            confetti({ particleCount: 60, spread: 60, origin: { y: 0.8 }, shapes: ["circle"], colors: ["#ff4d6d", "#ffd166", "#ffffff"], disableForReducedMotion: true });
          }}
        />
      </Sheet>

      {open !== null ? (
        <Viewer
          slug={p.slug}
          photos={viewerList}
          index={open.i}
          onIndex={(i) => {
            setOpen({ ...open, i });
            if (i >= viewerList.length - 3) (open.list === "top" ? top : gallery).more();
          }}
          onClose={() => setOpen(null)}
          voting={f.voting}
          onVote={vote}
          missions={missionMap}
          onFolder={openFolder}
        />
      ) : null}
    </div>
  );
}

function JoinForm({ slug, askName, siteKey, onJoined, canUpload }: { slug: string; askName: boolean; siteKey: string | null; onJoined: (j: { name: string | null; uploaded: number }) => void; canUpload: boolean }) {
  const [state, run, busy] = useActionState(join.bind(null, slug), {} as JoinState);
  const cb = useRef(onJoined);
  useEffect(() => {
    cb.current = onJoined;
  });
  useEffect(() => {
    if (state.joined) cb.current(state.joined);
  }, [state.joined]);
  if (!canUpload) return <p className="text-sm text-muted-foreground">This album is closed for new photos and wishes.</p>;
  return (
    <form action={run} className="grid gap-3">
      {askName ? (
        <label className="grid gap-1.5">
          <span className="text-sm font-semibold">Your name</span>
          <input name="name" maxLength={60} autoComplete="name" autoFocus placeholder="So everyone knows who snapped it" className="h-12 rounded-xl border border-input bg-background px-3 outline-none focus:border-ink" />
        </label>
      ) : null}
      {siteKey ? <Turnstile siteKey={siteKey} /> : null}
      {state.error ? <p className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p> : null}
      <button disabled={busy} className="inline-flex h-12 items-center justify-center gap-2 rounded-full font-semibold text-white disabled:opacity-60" style={{ background: "var(--accent)" }}>
        {busy ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
        Let&apos;s go 🎉
      </button>
    </form>
  );
}
