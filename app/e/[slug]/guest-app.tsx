"use client";

import Link from "next/link";
import { useActionState, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import confetti from "canvas-confetti";
import { ArrowRight, Calendar, Camera, ChevronLeft, Download, Heart, ImagePlus, Images, Loader2, MapPin, MessageCircleHeart, Share2, User, Users } from "lucide-react";
import { Logo } from "@/components/brand";
import { Turnstile } from "@/components/turnstile";
import type { Quality } from "@/lib/client/compress";
import { useUploader } from "@/lib/client/uploader";
import type { GalleryPhoto } from "@/lib/photos";
import { join, type JoinState } from "./actions";
import { DisposableCamera } from "./camera";
import {
  AlbumCard,
  Avatar,
  Masonry,
  MissionsProgress,
  PeopleGrid,
  PeopleRow,
  Sheet,
  TopSnappers,
  UploadReview,
  WishForm,
  WishesPanel,
  usePeople,
  type MissionInfo,
  type PersonItem,
  type Snapper,
  type TopPhoto,
} from "./panels";
import { useGallery, type GalleryFilter } from "./use-gallery";
import { Viewer } from "./viewer";

type Features = { camera: boolean; wishes: boolean; voting: boolean; missions: boolean; albumDownload: boolean };

type Props = {
  slug: string;
  event: {
    name: string;
    description: string;
    date: string;
    venue: string;
    cover: string | null;
    logo: string | null;
    accent: string;
    poweredBy: boolean;
    askName: boolean;
    review: boolean;
    cameraOnly: boolean;
  };
  features: Features;
  canUpload: boolean;
  guest: { id: string; name: string | null; uploaded: number; blocked: boolean } | null;
  limits: { perGuest: number; maxBytes: number };
  quality: Quality;
  initial: { photos: GalleryPhoto[]; next: string | null; count: number };
  missions: MissionInfo[];
  missionsDone: string[];
  stats: Omit<Stats, "missions" | "missionsDone">;
  siteKey: string | null;
};

type Tab = "highlights" | "people" | "all" | "wishes";
/** A filtered photo list opened from Highlights / People. */
type Album = { title: string; subtitle?: string; filter: GalleryFilter; person?: PersonItem } | null;
type Pending = { kind: "camera" | "upload" | "wish" | "join"; mission?: string | null } | null;
type Stats = { photos: number; guests: number; joined: number; wishes: number; topSnappers: Snapper[]; topPhotos: TopPhoto[]; missions: MissionInfo[]; missionsDone: string[] };

const ALL: GalleryFilter = { order: "new", guest: null, mission: null };

export function GuestApp(p: Props) {
  const [joined, setJoined] = useState(p.guest);
  const [tab, setTab] = useState<Tab>(p.features.missions && p.missions.length ? "highlights" : "all");
  const [album, setAlbum] = useState<Album>(null);
  const [order, setOrder] = useState<"new" | "old" | "top">("new");
  const [open, setOpen] = useState<{ list: "all" | "album"; i: number } | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [mission, setMission] = useState<string | null>(null);
  const [joinFor, setJoinFor] = useState<Pending>(null);
  const [wishOpen, setWishOpen] = useState(false);
  const [wishKey, setWishKey] = useState(0);
  const [peopleKey, setPeopleKey] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [picks, setPicks] = useState<{ key: string; file: File; url: string }[]>([]);
  const [pickMissionId, setPickMissionId] = useState<string | null>(null);
  // First paint uses numbers computed on the server (no "0 guests" flash), then polls.
  const [stats, setStats] = useState<Stats>({ ...p.stats, missions: p.missions, missionsDone: p.missionsDone });
  const pick = useRef<HTMLInputElement>(null);
  const statsRef = useRef(p.initial.count);
  const tabsRef = useRef<HTMLDivElement>(null);
  const f = p.features;
  const style = { "--accent": p.event.accent } as CSSProperties;

  const all = useGallery(p.slug, { ...ALL, order: order === "top" && !f.voting ? "new" : order }, order === "new" ? { photos: p.initial.photos, next: p.initial.next } : undefined);
  const albumFilter = album?.filter ?? { order: "top" as const, guest: null, mission: null };
  const albumGallery = useGallery(p.slug, albumFilter);
  const people = usePeople(p.slug, peopleKey);
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

  const flash = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }, []);

  const up = useUploader({
    slug: p.slug,
    quality: p.quality,
    maxBytes: p.limits.maxBytes,
    remaining: Math.max(0, p.limits.perGuest - (joined?.uploaded ?? 0)),
    onUploaded: () => {
      all.refreshSoon();
      setTimeout(loadStats, 4000);
      setTimeout(() => setPeopleKey((k) => k + 1), 5000);
    },
    onNeedJoin: () => {
      // Session lost (e.g. cookie cleared): ask them to join again instead of leaving them stuck.
      setJoined(null);
      setJoinFor({ kind: "upload" });
    },
    onIdle: (ok) => {
      if (!ok) return;
      confetti({ particleCount: 110, spread: 75, origin: { y: 0.8 }, colors: ["#e91d48", "#ffd166", "#ffffff", "#16a34a"], disableForReducedMotion: true });
      flash(ok === 1 ? `Shared! You're snap #${statsRef.current + 1} 🎉` : `${ok} photos shared! 🎉`);
    },
  });

  const canShoot = p.canUpload && !joined?.blocked;
  const start = useCallback(
    (kind: "camera" | "upload" | "wish", m: string | null = null) => {
      if (!joined) return setJoinFor({ kind, mission: m });
      if (kind === "wish") return setWishOpen(true);
      if (kind === "camera" && f.camera) {
        setMission(m);
        return setCameraOpen(true);
      }
      setPickMissionId(m);
      pick.current?.click();
    },
    [joined, f.camera],
  );

  const onJoined = useCallback(
    (g: { id: string; name: string | null; uploaded: number }) => {
      setJoined({ ...g, blocked: false });
      const next = joinFor;
      setJoinFor(null);
      if (!next || next.kind === "join") return;
      setTimeout(() => {
        if (next.kind === "wish") setWishOpen(true);
        else if (next.kind === "camera" && f.camera) {
          setMission(next.mission ?? null);
          setCameraOpen(true);
        } else flash("You're in! Tap Upload to pick your photos 📸"); // iOS blocks file pickers not opened by a tap
      }, 50);
    },
    [joinFor, f.camera, flash],
  );

  const vote = useCallback(
    async (ph: GalleryPhoto) => {
      if (!joined) return setJoinFor({ kind: "join" });
      const opt = { voted: !ph.voted, votes: ph.votes + (ph.voted ? -1 : 1) };
      all.patchPhoto(ph.id, opt);
      albumGallery.patchPhoto(ph.id, opt);
      const r = await fetch(`/api/e/${p.slug}/photos/${ph.id}/vote`, { method: "POST" }).catch(() => null);
      const b = r?.ok ? ((await r.json()) as { voted: boolean; votes: number }) : { voted: ph.voted, votes: ph.votes };
      all.patchPhoto(ph.id, b);
      albumGallery.patchPhoto(ph.id, b);
    },
    [joined, all, albumGallery, p.slug],
  );

  const scrollToTabs = useCallback(() => tabsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), []);
  const openAlbum = (a: NonNullable<Album>) => {
    setAlbum(a);
    scrollToTabs();
  };
  const openPerson = (person: PersonItem) =>
    openAlbum({ title: `Photos by ${person.name ?? "Guest"}`, subtitle: `${person.count} photo${person.count === 1 ? "" : "s"}`, person, filter: { order: "new", guest: person.id, mission: null } });
  const openMission = (m: MissionInfo) => openAlbum({ title: m.title, subtitle: `${m.count} photo${m.count === 1 ? "" : "s"}`, filter: { order: "new", guest: null, mission: m.id } });
  const openTop = () => openAlbum({ title: "Most loved", subtitle: "The photos guests hearted most", filter: { order: "top", guest: null, mission: null } });
  const myPhotos = () => joined && openAlbum({ title: "My photos", filter: { order: "new", guest: joined.id, mission: null } });

  const addPicks = (list: FileList) => {
    const add = Array.from(list).map((file) => ({ key: `${Date.now()}-${Math.random().toString(36).slice(2)}`, file, url: URL.createObjectURL(file) }));
    setPicks((x) => [...x, ...add]);
  };
  const sharePicks = () => {
    up.add(
      picks.map((x) => x.file),
      { mission: pickMissionId },
    );
    picks.forEach((x) => URL.revokeObjectURL(x.url));
    setPicks([]);
  };

  const shotsLeft = up.available;
  const viewerList = open?.list === "album" ? albumGallery.photos : all.photos;
  const busy = up.items.filter((i) => i.status !== "done" && i.status !== "error").length;
  const failed = up.items.filter((i) => i.status === "error");
  const tabs: { id: Tab; label: string; show: boolean }[] = [
    { id: "highlights", label: "Highlights", show: true },
    { id: "people", label: "By People", show: true },
    { id: "all", label: "All Photos", show: true },
    { id: "wishes", label: "Wishes", show: f.wishes },
  ];
  const coverPhotos = all.photos.slice(0, 3);

  return (
    <div style={style} className="min-h-dvh bg-paper pb-32">
      {/* ------------------------------------------------------------ top bar */}
      <header className="sticky top-0 z-30 border-b border-black/5 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          {p.event.logo ? <img src={p.event.logo} alt="" className="h-8 w-auto" /> : <Logo className="text-lg" />}
          <button
            type="button"
            onClick={() => (navigator.share ? navigator.share({ title: p.event.name, url: location.href }).catch(() => {}) : navigator.clipboard?.writeText(location.href).then(() => flash("Link copied ✨")))}
            className="grid size-10 place-items-center rounded-full hover:bg-muted"
            aria-label="Share this album"
          >
            <Share2 className="size-5" aria-hidden />
          </button>
        </div>
      </header>

      {/* ------------------------------------------------------------ hero */}
      <section className="relative mx-auto max-w-3xl overflow-hidden px-4 pb-6 pt-6">
        <div className="relative mx-auto max-w-md">
          <div className="relative -rotate-2 bg-white p-3 pb-4 shadow-lift">
            <span className="absolute -top-3 left-8 h-6 w-20 rotate-[-6deg] bg-[#efe3cf]/90 shadow-sm" aria-hidden />
            <span className="absolute -top-3 right-10 h-6 w-16 rotate-[8deg] bg-[#efe3cf]/90 shadow-sm" aria-hidden />
            <div className="aspect-[4/3] overflow-hidden bg-muted">
              {p.event.cover ? (
                <img src={p.event.cover} alt="" className="size-full object-cover" />
              ) : coverPhotos.length ? (
                <div className="grid size-full grid-cols-3 gap-1">
                  {coverPhotos.map((c, i) => (
                    <img key={c.id} src={c.md} alt="" className={`size-full object-cover ${i === 0 ? "col-span-2 row-span-2" : ""}`} />
                  ))}
                </div>
              ) : (
                <div className="grid size-full place-items-center bg-gradient-to-br from-brand-soft to-[#ffd0da]">
                  <Camera className="size-14 text-brand/70" aria-hidden />
                </div>
              )}
            </div>
          </div>
          <p className="absolute -right-1 -top-2 rotate-6 rounded-sm bg-white/95 px-2 py-1 font-script text-lg leading-tight text-ink shadow-soft sm:-right-6">
            Every guest.
            <br />
            Every angle.
            <br />
            Every memory. <span className="text-brand">♡</span>
          </p>
          <div className="pointer-events-none absolute -bottom-3 -left-4 h-10 w-24 -rotate-12 rounded-sm bg-ink [background-image:repeating-linear-gradient(90deg,transparent_0_6px,#fff_6px_10px,transparent_10px_16px)] [background-size:16px_8px] [background-repeat:repeat-x] [background-position:0_2px,0_bottom]" aria-hidden />
        </div>

        <h1 className="mt-8 text-center font-script text-5xl font-bold leading-none text-ink sm:text-6xl">{p.event.name}</h1>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="size-4" aria-hidden /> {p.event.date}
          </span>
          {p.event.venue ? (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-4" aria-hidden /> {p.event.venue}
            </span>
          ) : null}
        </div>
        {p.event.description ? <p className="mx-auto mt-3 max-w-md whitespace-pre-line text-center text-sm text-muted-foreground">{p.event.description}</p> : null}

        <div className="mx-auto mt-5 grid max-w-md grid-cols-3 divide-x divide-border rounded-3xl bg-white py-4 text-center shadow-soft">
          {[
            { icon: Camera, n: stats.photos, l: "Photos" },
            { icon: Users, n: stats.guests, l: "Contributors" },
            { icon: User, n: stats.joined, l: "Guests" },
          ].map((s) => (
            <div key={s.l} className="grid justify-items-center gap-0.5">
              <s.icon className="size-5 text-brand" aria-hidden />
              <span className="text-xl font-extrabold tabular-nums">{s.n.toLocaleString("en-MY")}</span>
              <span className="text-xs text-muted-foreground">{s.l}</span>
            </div>
          ))}
        </div>

        <div className="mx-auto mt-5 grid max-w-md gap-3">
          <button type="button" onClick={scrollToTabs} className="inline-flex h-14 items-center justify-center gap-2 rounded-full bg-brand text-lg font-bold text-white shadow-cherry">
            View Gallery <ArrowRight className="size-5" aria-hidden />
          </button>
          {canShoot ? (
            <button type="button" onClick={() => start(f.camera ? "camera" : "upload")} className="mx-auto inline-flex h-12 items-center gap-2 rounded-full border border-border bg-white px-6 font-semibold shadow-soft">
              <ImagePlus className="size-5" aria-hidden /> Share Your Photos
            </button>
          ) : (
            <p className="text-center text-sm text-muted-foreground">Uploads are closed. Browse and save your favourites below.</p>
          )}
          {joined ? (
            <p className="text-center text-sm">
              Hi <strong>{joined.name ?? "there"}</strong> 👋{" "}
              {canShoot ? (
                <span className="text-muted-foreground">
                  You have <strong className="text-ink">{shotsLeft}</strong> shot{shotsLeft === 1 ? "" : "s"} left.
                </span>
              ) : null}
            </p>
          ) : null}
          {joined?.blocked ? <p className="rounded-2xl bg-muted px-4 py-3 text-center text-sm text-muted-foreground">Uploads from this phone were turned off by the organiser.</p> : null}
          {p.event.review && canShoot ? <p className="text-center text-xs text-muted-foreground">Photos appear once the hosts approve them.</p> : null}
        </div>
        <p className="mt-5 text-right font-script text-xl text-ink/80">
          Good people, great memories <span className="text-brand">♥</span>
        </p>
      </section>

      {/* ------------------------------------------------------------ quick actions */}
      <section className="mx-auto max-w-3xl px-4">
        <div className="grid grid-cols-4 gap-2 rounded-3xl bg-ink p-3 text-white shadow-lift">
          {canShoot ? (
            <QuickAction icon={Camera} label={f.camera ? "Snap" : "Upload"} onClick={() => start(f.camera ? "camera" : "upload")} />
          ) : null}
          <QuickAction icon={Images} label="Gallery" onClick={() => (setAlbum(null), setTab("all"), scrollToTabs())} />
          <QuickAction icon={User} label="My photos" onClick={() => (joined ? myPhotos() : setJoinFor({ kind: "join" }))} />
          {f.albumDownload ? (
            <QuickAction icon={Download} label="Download" href={`/api/e/${p.slug}/album`} />
          ) : f.wishes && !joined?.blocked && p.canUpload ? (
            <QuickAction icon={MessageCircleHeart} label="Wish" onClick={() => start("wish")} />
          ) : null}
        </div>
      </section>

      {busy || up.notice || failed.length ? (
        <section className="mx-auto mt-4 max-w-3xl px-4">
          {up.notice ? <p className="mb-2 rounded-2xl bg-warn-soft px-4 py-2 text-sm text-warn">{up.notice}</p> : null}
          {failed.length && !busy ? (
            <div className="mb-2 flex items-center justify-between gap-3 rounded-2xl bg-danger-soft px-4 py-2 text-sm text-danger" role="alert">
              <span>
                {failed.length} photo{failed.length === 1 ? "" : "s"} couldn&apos;t be shared{failed[0].error ? `: ${failed[0].error}` : "."}
              </span>
              <button type="button" onClick={up.clearDone} className="shrink-0 font-semibold underline">
                OK
              </button>
            </div>
          ) : null}
          {busy ? (
            <div className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-soft">
              <Loader2 className="size-5 animate-spin text-brand" aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">
                  Sharing {busy} photo{busy === 1 ? "" : "s"}…
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${Math.max(8, (up.items.filter((i) => i.status === "done").length / Math.max(1, up.items.length)) * 100)}%` }} />
                </div>
              </div>
              <span className="text-xs text-muted-foreground">Keep this open</span>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* ------------------------------------------------------------ tabs */}
      <div ref={tabsRef} className="scroll-mt-14" />
      <nav className="sticky top-14 z-20 mt-6 border-b border-border bg-paper/95 backdrop-blur">
        <div className="no-scrollbar mx-auto flex max-w-3xl gap-1 overflow-x-auto px-3">
          {tabs
            .filter((t) => t.show)
            .map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setAlbum(null);
                  setTab(t.id);
                }}
                className={`-mb-px shrink-0 border-b-2 px-3 py-3 text-sm font-semibold ${tab === t.id && !album ? "border-brand text-brand" : "border-transparent text-muted-foreground"}`}
              >
                {t.label}
              </button>
            ))}
        </div>
      </nav>

      <main className="mx-auto mt-4 max-w-3xl px-2 sm:px-4">
        {album ? (
          <section className="[animation:pc-rise_0.3s_ease]">
            <div className="mb-4 flex items-center gap-3 px-2">
              <button type="button" onClick={() => setAlbum(null)} className="grid size-10 shrink-0 place-items-center rounded-full bg-white shadow-soft" aria-label="Back">
                <ChevronLeft className="size-5" aria-hidden />
              </button>
              {album.person ? <Avatar person={album.person} /> : null}
              <div className="min-w-0">
                <h2 className="truncate text-xl font-extrabold">{album.title}</h2>
                {album.subtitle ? <p className="text-sm text-muted-foreground">{album.subtitle}</p> : null}
              </div>
            </div>
            {album.person && f.missions && stats.missions.length ? (
              <div className="no-scrollbar mb-3 flex gap-2 overflow-x-auto px-2">
                <button type="button" onClick={() => setAlbum({ ...album, filter: { ...album.filter, mission: null } })} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${album.filter.mission ? "bg-white" : "bg-brand text-white"}`}>
                  All ({album.person.count})
                </button>
                {stats.missions.map((m) => (
                  <button key={m.id} type="button" onClick={() => setAlbum({ ...album, filter: { ...album.filter, mission: m.id } })} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${album.filter.mission === m.id ? "bg-brand text-white" : "bg-white"}`}>
                    {m.emoji ?? "🎯"} {m.title}
                  </button>
                ))}
              </div>
            ) : null}
            <Masonry gallery={albumGallery} missions={missionMap} onOpen={(i) => setOpen({ list: "album", i })} empty="Nothing here yet." />
          </section>
        ) : tab === "highlights" ? (
          <div className="grid gap-4 px-2">
            {f.missions ? <MissionsProgress missions={stats.missions} done={done} canShoot={canShoot} onPick={(id) => (canShoot ? start(f.camera ? "camera" : "upload", id) : openMission(missionMap.get(id)!))} /> : null}
            {f.voting && stats.topPhotos.length ? <AlbumCard title="Most loved" subtitle={`${stats.topPhotos[0].votes} ❤️ on the top photo`} cover={stats.topPhotos[0].md} onClick={openTop} tall /> : null}
            {f.missions && stats.missions.some((m) => m.count) ? (
              <div className="grid grid-cols-2 gap-3">
                {stats.missions
                  .filter((m) => m.count)
                  .map((m, i) => (
                    <div key={m.id} className={i === 0 ? "col-span-2" : ""}>
                      <AlbumCard title={m.title} emoji={m.emoji} subtitle={`${m.count} photo${m.count === 1 ? "" : "s"}`} cover={m.cover ?? null} onClick={() => openMission(m)} tall={i === 0} />
                    </div>
                  ))}
              </div>
            ) : null}
            {people?.length ? (
              <section className="rounded-3xl bg-white p-4 shadow-soft">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-bold">Browse by people</h3>
                  <button type="button" onClick={() => setTab("people")} className="text-sm font-semibold text-brand">
                    See all
                  </button>
                </div>
                <PeopleRow people={people} onOpen={openPerson} />
              </section>
            ) : null}
            {f.voting ? <TopSnappers snappers={stats.topSnappers} /> : null}
            <section>
              <div className="mb-3 flex items-center justify-between px-1">
                <h3 className="font-bold">Latest moments</h3>
                <button type="button" onClick={() => setTab("all")} className="inline-flex items-center gap-1 text-sm font-semibold text-brand">
                  All photos <ArrowRight className="size-4" aria-hidden />
                </button>
              </div>
              <Masonry gallery={{ ...all, photos: all.photos.slice(0, 12), next: null }} missions={missionMap} onOpen={(i) => setOpen({ list: "all", i })} empty="No photos yet — be the first to snap one!" />
            </section>
          </div>
        ) : tab === "people" ? (
          <div className="px-2">
            <h2 className="mb-1 text-2xl font-extrabold">Browse by people</h2>
            <p className="mb-4 text-sm text-muted-foreground">See who captured the moments.</p>
            <PeopleGrid people={people} onOpen={openPerson} />
          </div>
        ) : tab === "all" ? (
          <section>
            <div className="mb-3 flex items-end justify-between gap-2 px-2">
              <div>
                <h2 className="text-2xl font-extrabold">All Photos</h2>
                <p className="text-sm text-muted-foreground">{stats.photos.toLocaleString("en-MY")} photos</p>
              </div>
              <label className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-sm font-semibold shadow-soft">
                <span className="sr-only">Sort</span>
                <select value={order} onChange={(e) => setOrder(e.target.value as typeof order)} className="bg-transparent outline-none">
                  <option value="new">Newest</option>
                  <option value="old">Oldest</option>
                  {f.voting ? <option value="top">Most loved</option> : null}
                </select>
              </label>
            </div>
            <Masonry gallery={all} missions={missionMap} onOpen={(i) => setOpen({ list: "all", i })} empty="No photos yet — be the first to snap one!" />
          </section>
        ) : (
          <div className="px-2">
            <WishesPanel slug={p.slug} canWrite={!joined?.blocked && p.canUpload} onWrite={() => start("wish")} refreshKey={wishKey} />
          </div>
        )}
      </main>

      {p.event.poweredBy ? (
        <footer className="mt-12 flex justify-center">
          <Link href="/" className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            Made with <Logo className="text-xs" />
          </Link>
        </footer>
      ) : null}

      {/* ------------------------------------------------------------ floating actions */}
      {canShoot || (f.wishes && !joined?.blocked && p.canUpload) ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-white/95 p-1.5 shadow-lift backdrop-blur">
            {canShoot && f.camera ? (
              <button type="button" onClick={() => start("camera")} disabled={!!joined && shotsLeft <= 0} className="inline-flex h-12 items-center gap-2 rounded-full bg-brand px-6 font-bold text-white shadow-cherry disabled:opacity-50">
                <Camera className="size-5" aria-hidden /> Snap
              </button>
            ) : null}
            {canShoot && !(f.camera && p.event.cameraOnly) ? (
              <button
                type="button"
                onClick={() => start("upload")}
                disabled={!!joined && shotsLeft <= 0}
                className={f.camera ? "grid size-12 place-items-center rounded-full bg-muted disabled:opacity-50" : "inline-flex h-12 items-center gap-2 rounded-full bg-brand px-6 font-bold text-white shadow-cherry disabled:opacity-50"}
                aria-label="Upload"
              >
                <ImagePlus className="size-5" aria-hidden />
                {f.camera ? null : "Upload Photos"}
              </button>
            ) : null}
            {f.wishes && !joined?.blocked && p.canUpload ? (
              <button type="button" onClick={() => start("wish")} className="grid size-12 place-items-center rounded-full bg-muted" aria-label="Write a wish">
                <Heart className="size-5" aria-hidden />
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
          if (e.target.files?.length) addPicks(e.target.files);
          e.target.value = "";
        }}
      />

      {toast ? (
        <div className="fixed inset-x-0 bottom-24 z-40 flex justify-center px-4" role="status">
          <div className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white shadow-lift [animation:pc-pop_3.5s_ease_forwards]">{toast}</div>
        </div>
      ) : null}

      {cameraOpen ? (
        <DisposableCamera
          onClose={() => setCameraOpen(false)}
          onShot={(file) => up.add([file], { mission, prepared: true })}
          onFallback={() => {
            history.back();
            setPickMissionId(mission);
            pick.current?.click();
          }}
          shotsLeft={shotsLeft}
          quality={p.quality}
          maxBytes={p.limits.maxBytes}
          missions={f.missions ? stats.missions : []}
          mission={mission}
          onMission={setMission}
          caption={p.event.name}
        />
      ) : null}

      <Sheet
        open={picks.length > 0}
        onClose={() => {
          picks.forEach((x) => URL.revokeObjectURL(x.url));
          setPicks([]);
        }}
        title="Ready to share?"
      >
        <UploadReview
          files={picks}
          onRemove={(key) =>
            setPicks((x) => {
              const r = x.find((y) => y.key === key);
              if (r) URL.revokeObjectURL(r.url);
              return x.filter((y) => y.key !== key);
            })
          }
          onAdd={() => pick.current?.click()}
          onShare={sharePicks}
          missions={f.missions ? stats.missions : []}
          mission={pickMissionId}
          onMission={setPickMissionId}
          left={shotsLeft}
        />
      </Sheet>

      <Sheet open={!!joinFor} onClose={() => setJoinFor(null)} title="Join the album">
        <JoinForm slug={p.slug} askName={p.event.askName} siteKey={p.siteKey} onJoined={onJoined} canUpload={p.canUpload} />
      </Sheet>

      <Sheet open={wishOpen} onClose={() => setWishOpen(false)} title="💌 Write a wish">
        <WishForm
          slug={p.slug}
          myPhotos={all.photos.filter((x) => x.mine)}
          onDone={() => {
            setWishOpen(false);
            setWishKey((k) => k + 1);
            setAlbum(null);
            setTab("wishes");
            loadStats();
            confetti({ particleCount: 70, spread: 60, origin: { y: 0.8 }, shapes: ["circle"], colors: ["#e91d48", "#ffd166", "#ffffff"], disableForReducedMotion: true });
          }}
        />
      </Sheet>

      {open !== null ? (
        <Viewer
          slug={p.slug}
          photos={viewerList}
          index={open.i}
          total={open.list === "all" ? stats.photos : undefined}
          onIndex={(i) => {
            setOpen({ ...open, i });
            if (i >= viewerList.length - 3) (open.list === "album" ? albumGallery : all).more();
          }}
          onClose={() => setOpen(null)}
          voting={f.voting}
          onVote={vote}
          missions={missionMap}
          onFolder={(g, name) => {
            history.back();
            setTimeout(() => {
              const person = people?.find((x) => x.id === g) ?? { id: g, name, count: 0, cover: null, hearts: 0 };
              openPerson(person);
            }, 0);
          }}
        />
      ) : null}
    </div>
  );
}

function JoinForm({
  slug,
  askName,
  siteKey,
  onJoined,
  canUpload,
}: {
  slug: string;
  askName: boolean;
  siteKey: string | null;
  onJoined: (j: { id: string; name: string | null; uploaded: number }) => void;
  canUpload: boolean;
}) {
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
      <p className="text-sm text-muted-foreground">One tap and you&apos;re in — no app, no password.</p>
      {askName ? (
        <label className="grid gap-1.5">
          <span className="text-sm font-semibold">Your name</span>
          <input name="name" maxLength={60} autoComplete="name" autoFocus placeholder="So everyone knows who snapped it" className="h-12 rounded-2xl border border-input bg-background px-4 outline-none focus:border-brand" />
        </label>
      ) : null}
      {siteKey ? <Turnstile siteKey={siteKey} /> : null}
      {state.error ? <p className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p> : null}
      <button disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-full bg-brand py-3.5 font-bold text-white shadow-cherry disabled:opacity-60">
        {busy ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
        Let&apos;s go 🎉
      </button>
    </form>
  );
}

function QuickAction({ icon: Icon, label, onClick, href }: { icon: typeof Camera; label: string; onClick?: () => void; href?: string }) {
  const inner = (
    <>
      <span className="grid size-11 place-items-center rounded-2xl border border-white/15">
        <Icon className="size-5" aria-hidden />
      </span>
      {label}
    </>
  );
  const cls = "grid justify-items-center gap-1.5 rounded-2xl py-2 text-xs font-semibold hover:bg-white/10";
  return href ? (
    <a href={href} className={cls}>
      {inner}
    </a>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}
