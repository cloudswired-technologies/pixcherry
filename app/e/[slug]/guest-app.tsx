"use client";

import Link from "next/link";
import { useActionState, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import confetti from "canvas-confetti";
import { ArrowRight, Calendar, Camera, ChevronLeft, Download, ImagePlus, Images, Loader2, MapPin, MessageCircleHeart, MoreHorizontal, PartyPopper, Share2, Sparkles, User, Users } from "lucide-react";
import { Logo } from "@/components/brand";
import { Turnstile } from "@/components/turnstile";
import type { Quality } from "@/lib/client/compress";
import { useUploader } from "@/lib/client/uploader";
import { makeShareCard } from "@/lib/client/share-card";
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

type Features = { camera: boolean; wishes: boolean; voting: boolean; missions: boolean; albumDownload: boolean; tags: boolean };
type TagAlbum = { tag: string; count: number; cover: string | null };

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
    ended: boolean;
  };
  features: Features;
  canUpload: boolean;
  guest: { id: string; name: string | null; uploaded: number; blocked: boolean } | null;
  limits: { perGuest: number; maxBytes: number };
  quality: Quality;
  initial: { photos: GalleryPhoto[]; next: string | null; count: number };
  missions: MissionInfo[];
  missionsDone: string[];
  stats: Omit<Stats, "missions" | "missionsDone" | "tagAlbums">;
  suggestedTags: string[];
  tagAlbums: TagAlbum[];
  siteKey: string | null;
};

type Tab = "highlights" | "people" | "all" | "wishes";
/** A filtered photo list opened from Highlights / People. */
type Album = { title: string; subtitle?: string; filter: GalleryFilter; person?: PersonItem } | null;
type Pending = { kind: "camera" | "upload" | "wish" | "join"; mission?: string | null } | null;
type Stats = { photos: number; guests: number; joined: number; wishes: number; topSnappers: Snapper[]; topPhotos: TopPhoto[]; missions: MissionInfo[]; missionsDone: string[]; tagAlbums: TagAlbum[] };

const ALL: GalleryFilter = { order: "new", guest: null, mission: null };

export function GuestApp(p: Props) {
  const [joined, setJoined] = useState(p.guest);
  const [tab, setTab] = useState<Tab>(p.features.tags || (p.features.missions && p.missions.length) ? "highlights" : "all");
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
  const [moreOpen, setMoreOpen] = useState(false);
  const [picks, setPicks] = useState<{ key: string; file: File; url: string }[]>([]);
  const [pickMissionId, setPickMissionId] = useState<string | null>(null);
  // First paint uses numbers computed on the server (no "0 guests" flash), then polls.
  const [stats, setStats] = useState<Stats>({ ...p.stats, missions: p.missions, missionsDone: p.missionsDone, tagAlbums: p.tagAlbums });
  const [pickTags, setPickTags] = useState<string[]>([]);
  const pick = useRef<HTMLInputElement>(null);
  const statsRef = useRef(p.initial.count);
  const tabsRef = useRef<HTMLDivElement>(null);
  const f = p.features;
  // Custom branding: the organiser's colour replaces the cherry everywhere on this page.
  const style = { "--accent": p.event.accent, "--brand": p.event.accent, "--brand-strong": p.event.accent } as CSSProperties;

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
  const openTag = (tag: string) => {
    const a = stats.tagAlbums.find((x) => x.tag === tag);
    openAlbum({ title: `#${tag}`, subtitle: a ? `${a.count} photo${a.count === 1 ? "" : "s"}` : undefined, filter: { order: "new", guest: null, mission: null, tag } });
  };
  const openTop = () => openAlbum({ title: "Most loved", subtitle: "The photos guests hearted most", filter: { order: "top", guest: null, mission: null } });
  const myPhotos = () => joined && openAlbum({ title: "My photos", filter: { order: "new", guest: joined.id, mission: null } });

  const addPicks = (list: FileList) => {
    const add = Array.from(list).map((file) => ({ key: `${Date.now()}-${Math.random().toString(36).slice(2)}`, file, url: URL.createObjectURL(file) }));
    setPicks((x) => [...x, ...add]);
  };
  const sharePicks = () => {
    up.add(
      picks.map((x) => x.file),
      { mission: pickMissionId, tags: pickTags },
    );
    setPickTags([]);
    picks.forEach((x) => URL.revokeObjectURL(x.url));
    setPicks([]);
  };

  const shareCard = async () => {
    if (!joined) return setJoinFor({ kind: "join" });
    const mine = all.photos.filter((x) => x.mine && x.status === "ready");
    const count = people?.find((x) => x.id === joined.id)?.count ?? mine.length;
    if (!mine.length) return flash("Share a photo first, then make your story card 📸");
    flash("Making your story card…");
    try {
      const blob = await makeShareCard({
        eventName: p.event.name,
        date: p.event.date,
        count,
        photoUrls: mine.slice(0, 3).map((x) => `/api/e/${p.slug}/photos/${x.id}/download`),
        accent: p.event.accent,
        guestName: null,
      });
      const file = new File([blob], "pixcherry-story.jpg", { type: "image/jpeg" });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file] });
      else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = file.name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      }
    } catch {
      /* cancelled */
    }
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

  return (
    <div style={style} className="min-h-dvh bg-paper pb-28">
      {/* ------------------------------------------------------------ top bar */}
      <header className="sticky top-0 z-30 border-b border-black/5 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          {p.event.logo ? <img src={p.event.logo} alt="" className="h-8 w-auto" /> : <Logo className="text-lg" />}
        </div>
      </header>

      {/* ------------------------------------------------------------ header (compact) */}
      <section className="mx-auto max-w-3xl px-4 pt-4">
        <div className="overflow-hidden rounded-3xl bg-white shadow-soft">
          {p.event.cover ? <img src={p.event.cover} alt="" className="aspect-[16/7] w-full object-cover" /> : null}
          <div className="p-4">
            <h1 className="text-2xl font-extrabold leading-tight tracking-tight text-ink">{p.event.name}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="size-4" aria-hidden /> {p.event.date}
              </span>
              {p.event.venue ? (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="size-4" aria-hidden /> {p.event.venue}
                </span>
              ) : null}
            </div>
            {p.event.description ? <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{p.event.description}</p> : null}
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold">
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-1 text-brand">
                <Camera className="size-3.5" aria-hidden /> {stats.photos.toLocaleString("en-MY")} photo{stats.photos === 1 ? "" : "s"}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-ink/80">
                <Users className="size-3.5" aria-hidden /> {stats.guests} contributor{stats.guests === 1 ? "" : "s"}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-ink/80">
                <User className="size-3.5" aria-hidden /> {stats.joined} guest{stats.joined === 1 ? "" : "s"}
              </span>
            </div>
            {joined ? (
              <p className="mt-3 text-sm">
                Hi <strong>{joined.name ?? "there"}</strong> 👋{" "}
                {canShoot ? (
                  <span className="text-muted-foreground">
                    You have <strong className="text-ink">{shotsLeft}</strong> shot{shotsLeft === 1 ? "" : "s"} left.
                  </span>
                ) : null}
              </p>
            ) : null}
            {!p.canUpload ? <p className="mt-3 rounded-2xl bg-muted px-3 py-2 text-sm text-muted-foreground">Uploads are closed. Browse and save your favourites below.</p> : null}
            {joined?.blocked ? <p className="mt-3 rounded-2xl bg-muted px-3 py-2 text-sm text-muted-foreground">Uploads from this phone were turned off by the organiser.</p> : null}
            {p.event.review && canShoot ? <p className="mt-2 text-xs text-muted-foreground">Photos appear once the hosts approve them.</p> : null}
          </div>
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
      <nav className="sticky top-14 z-20 mt-4 border-b border-border bg-paper/95 backdrop-blur">
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
            {p.event.ended ? (
              <Link href={`/e/${p.slug}/recap`} className="flex items-center gap-3 rounded-3xl bg-ink p-4 text-white shadow-lift">
                <span className="text-3xl">✨</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold">The recap is ready</span>
                  <span className="block text-sm text-white/70">The whole day in numbers, the most loved photos and every wish.</span>
                </span>
                <ArrowRight className="size-5 shrink-0" aria-hidden />
              </Link>
            ) : null}
            {f.missions ? <MissionsProgress missions={stats.missions} done={done} canShoot={canShoot} onPick={(id) => (canShoot ? start(f.camera ? "camera" : "upload", id) : openMission(missionMap.get(id)!))} /> : null}
            {f.voting && stats.topPhotos.length ? <AlbumCard title="Most loved" subtitle={`${stats.topPhotos[0].votes} ❤️ on the top photo`} cover={stats.topPhotos[0].md} onClick={openTop} tall /> : null}
            {f.tags ? (
              stats.tagAlbums.length ? (
                <section>
                  <h3 className="mb-3 px-1 font-bold">Albums</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {stats.tagAlbums.map((a, i) => (
                      <div key={a.tag} className={i === 0 ? "col-span-2" : ""}>
                        <AlbumCard title={`#${a.tag}`} subtitle={`${a.count} photo${a.count === 1 ? "" : "s"}`} cover={a.cover} onClick={() => openTag(a.tag)} tall={i === 0} />
                      </div>
                    ))}
                  </div>
                </section>
              ) : (
                <section className="rounded-3xl border-2 border-dashed border-brand/25 bg-white p-5 text-center">
                  <div className="text-3xl">#️⃣</div>
                  <h3 className="mt-1 font-bold">Albums appear here</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    When you share a photo, tap a hashtag like <strong className="text-brand">#{p.suggestedTags[0] ?? "reception"}</strong> or <strong className="text-brand">#{p.suggestedTags[1] ?? "family"}</strong> — every hashtag becomes an album.
                  </p>
                </section>
              )
            ) : null}
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

      {/* ------------------------------------------------------------ bottom menu (one place for every action) */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur" aria-label="Actions">
        <div className="mx-auto grid max-w-md grid-cols-4 items-end px-2 pt-1.5">
          <BarButton icon={ImagePlus} label="Upload" onClick={() => start("upload")} disabled={!canShoot || (f.camera && p.event.cameraOnly) || (!!joined && shotsLeft <= 0)} />
          {f.camera ? (
            <button type="button" onClick={() => start("camera")} disabled={!canShoot || (!!joined && shotsLeft <= 0)} className="-mt-6 grid justify-items-center gap-1 pb-1.5 text-[11px] font-bold text-brand disabled:opacity-40" aria-label="Snap">
              <span className="grid size-14 place-items-center rounded-full border-4 border-white bg-brand text-white shadow-cherry">
                <Camera className="size-6" aria-hidden />
              </span>
              Snap
            </button>
          ) : (
            <BarButton icon={Images} label="Gallery" onClick={() => (setAlbum(null), setTab("all"), scrollToTabs())} />
          )}
          <BarButton icon={MessageCircleHeart} label="Wishes" onClick={() => (f.wishes ? (canShoot ? start("wish") : (setAlbum(null), setTab("wishes"), scrollToTabs())) : undefined)} disabled={!f.wishes} />
          <BarButton icon={MoreHorizontal} label="More" onClick={() => setMoreOpen(true)} />
        </div>
      </nav>

      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} title="More">
        <div className="grid gap-2">
          <MoreItem
            icon={Sparkles}
            label="Share my story card"
            onClick={() => {
              setMoreOpen(false);
              shareCard();
            }}
          />
          <MoreItem icon={PartyPopper} label="Event recap" href={`/e/${p.slug}/recap`} />
          <MoreItem
            icon={User}
            label="My photos"
            onClick={() => {
              setMoreOpen(false);
              if (joined) myPhotos();
              else setJoinFor({ kind: "join" });
            }}
          />
          {f.albumDownload ? <MoreItem icon={Download} label="Download the whole album" href={`/api/e/${p.slug}/album`} /> : null}
          <MoreItem
            icon={Share2}
            label="Share this album"
            onClick={() => {
              setMoreOpen(false);
              if (navigator.share) navigator.share({ title: p.event.name, url: location.href }).catch(() => {});
              else navigator.clipboard?.writeText(location.href).then(() => flash("Link copied ✨"));
            }}
          />
        </div>
      </Sheet>

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
        <div className="fixed inset-x-0 bottom-28 z-40 flex justify-center px-4" role="status">
          <div className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white shadow-lift [animation:pc-pop_3.5s_ease_forwards]">{toast}</div>
        </div>
      ) : null}

      {cameraOpen ? (
        <DisposableCamera
          onClose={() => setCameraOpen(false)}
          onShot={(file, tags) => up.add([file], { mission, prepared: true, tags })}
          suggestedTags={f.tags ? p.suggestedTags : null}
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
          tags={f.tags ? { suggested: p.suggestedTags, value: pickTags, onChange: setPickTags } : null}
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
          onTag={(t) => {
            history.back();
            setTimeout(() => openTag(t), 0);
          }}
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

function BarButton({ icon: Icon, label, onClick, disabled }: { icon: typeof Camera; label: string; onClick?: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="grid justify-items-center gap-1 py-1.5 text-[11px] font-semibold text-ink/80 disabled:opacity-35">
      <Icon className="size-6" aria-hidden />
      {label}
    </button>
  );
}

function MoreItem({ icon: Icon, label, onClick, href }: { icon: typeof Camera; label: string; onClick?: () => void; href?: string }) {
  const cls = "flex items-center gap-3 rounded-2xl bg-background px-4 py-3.5 text-left font-semibold";
  const inner = (
    <>
      <Icon className="size-5 text-brand" aria-hidden />
      {label}
    </>
  );
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
