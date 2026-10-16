"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type CSSProperties, type FormEvent } from "react";
import confetti from "canvas-confetti";
import {
  ArrowRight,
  Calendar,
  Camera,
  ChevronLeft,
  Download,
  ImagePlus,
  Images,
  Loader2,
  MapPin,
  MessageCircleHeart,
  MonitorPlay,
  MoreHorizontal,
  PartyPopper,
  Pencil,
  QrCode,
  Share2,
  Smartphone,
  Sparkles,
  User,
  Users,
} from "lucide-react";
import { Logo } from "@/components/brand";
import { Turnstile } from "@/components/turnstile";
import { useUploader } from "@/lib/client/uploader";
import { makeShareCard } from "@/lib/client/share-card";
import { deviceSignals } from "@/lib/client/device";
import type { GalleryPhoto } from "@/lib/photos";
import { join, rename, type JoinState } from "./actions";
import { MissionsPanel, TopPanel, useMissionBoard } from "./boards";
import { PixCamera } from "./camera";
import { SelfieButton, uploadSelfie } from "./selfie";
import { Welcome } from "./welcome";
import { Develop, PHOTO_JPEG, PHOTO_MAX_PX } from "./develop";
import { BestMoments, Stories, type Moment } from "./highlights";
import { InstallGuide, useInstall } from "./install";
import {
  AlbumCard,
  Avatar,
  Masonry,
  MissionsProgress,
  PeopleGrid,
  Sheet,
  UploadReview,
  WishForm,
  WishesPanel,
  initial,
  usePeople,
  type MissionInfo,
  type PendingTile,
  type PersonItem,
  type Snapper,
  type TopPhoto,
} from "./panels";
import { useGallery, type GalleryFilter } from "./use-gallery";
import { Viewer } from "./viewer";

type Features = { camera: boolean; wishes: boolean; voting: boolean; missions: boolean; albumDownload: boolean; tags: boolean; slideshow: boolean };
type TagAlbum = { tag: string; count: number; cover: string | null };
type Joined = { id: string; name: string | null; uploaded: number; blocked: boolean; avatar?: string | null };

type Props = {
  slug: string;
  /** Path of this album on the current host: /aina-hakim (guest host) or /e/aina-hakim. */
  base: string;
  /** Full link guests share (and the QR code). */
  shareUrl: string;
  qrSvg: string;
  /** Signed guest session for the home-screen app's start link. */
  resumeKey: string | null;
  /** Set when the host is looking at their own album: link back to their dashboard. */
  hostUrl: string | null;
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
  guest: Joined | null;
  limits: { perGuest: number; maxBytes: number };
  initial: { photos: GalleryPhoto[]; next: string | null; count: number };
  missions: MissionInfo[];
  missionsDone: string[];
  stats: Omit<Stats, "missions" | "missionsDone" | "tagAlbums">;
  suggestedTags: string[];
  tagAlbums: TagAlbum[];
  siteKey: string | null;
};

type Tab = "highlights" | "missions" | "people" | "all" | "top" | "wishes";
/** A filtered photo list opened from Highlights / People. */
type Album = { title: string; subtitle?: string; filter: GalleryFilter; person?: PersonItem } | null;
type Pending = { kind: "camera" | "upload" | "wish" | "join"; mission?: string | null } | null;
type Stats = { photos: number; guests: number; joined: number; wishes: number; topSnappers: Snapper[]; topPhotos: TopPhoto[]; missions: MissionInfo[]; missionsDone: string[]; tagAlbums: TagAlbum[] };

const ALL: GalleryFilter = { order: "new", guest: null, mission: null };
const CHEER = ["#e91d48", "#ffd166", "#ffffff", "#16a34a"];

function store(k: string, v?: string) {
  try {
    if (v === undefined) return localStorage.getItem(k);
    localStorage.setItem(k, v);
  } catch {
    /* private mode */
  }
  return null;
}

export function GuestApp(p: Props) {
  const [joined, setJoined] = useState(p.guest);
  const [key, setKey] = useState(p.resumeKey);
  const [tab, setTab] = useState<Tab>(p.features.tags || (p.features.missions && p.missions.length) ? "highlights" : "all");
  const [album, setAlbum] = useState<Album>(null);
  const [order, setOrder] = useState<"new" | "old" | "top">("new");
  // The viewer follows a photo id: new photos arriving at the top must not shift what's on screen.
  const [open, setOpen] = useState<{ list: "all" | "album"; id: string } | null>(null);
  // Snap opens the PixCamera; if the browser can't open a camera, the phone's own
  // camera app is the fallback and its photo goes through the "develop" screen.
  const [cameraOpen, setCameraOpen] = useState(false);
  const [shot, setShot] = useState<File | null>(null);
  const snap = useRef<HTMLInputElement>(null);
  const [mission, setMission] = useState<string | null>(null);
  const [joinFor, setJoinFor] = useState<Pending>(null);
  const [wishOpen, setWishOpen] = useState(false);
  const [wishKey, setWishKey] = useState(0);
  const [peopleKey, setPeopleKey] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [sheet, setSheet] = useState<"more" | "qr" | "you" | "install" | null>(null);
  const [picks, setPicks] = useState<{ key: string; file: File; url: string }[]>([]);
  const [pickMissionId, setPickMissionId] = useState<string | null>(null);
  // First paint uses numbers computed on the server (no "0 guests" flash), then polls.
  const [stats, setStats] = useState<Stats>({ ...p.stats, missions: p.missions, missionsDone: p.missionsDone, tagAlbums: p.tagAlbums });
  const [pickTags, setPickTags] = useState<string[]>([]);
  const pick = useRef<HTMLInputElement>(null);
  const statsRef = useRef(p.initial.count);
  const doneRef = useRef(new Set(p.missionsDone));
  const tabsRef = useRef<HTMLDivElement>(null);
  const f = p.features;
  const hasMissions = f.missions && stats.missions.length > 0;
  // Custom branding: the organiser's colour replaces the cherry everywhere on this page.
  const style = { "--accent": p.event.accent, "--brand": p.event.accent, "--brand-strong": p.event.accent } as CSSProperties;

  const all = useGallery(p.slug, { ...ALL, order: order === "top" && !f.voting ? "new" : order }, order === "new" ? { photos: p.initial.photos, next: p.initial.next } : undefined);
  const albumFilter = album?.filter ?? { order: "top" as const, guest: null, mission: null };
  const albumGallery = useGallery(p.slug, albumFilter);
  const people = usePeople(p.slug, peopleKey);
  const board = useMissionBoard(p.slug, hasMissions && tab === "missions", stats.photos);
  const missionMap = useMemo(() => new Map(stats.missions.map((m) => [m.id, m])), [stats.missions]);
  const done = useMemo(() => new Set(stats.missionsDone), [stats.missionsDone]);
  const master = hasMissions && stats.missions.every((m) => done.has(m.id));
  const install = useInstall();

  // One toast at a time; a new one restarts the timer (an older timer mustn't hide it early).
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flash = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }, []);

  const loadStats = useCallback(async () => {
    const r = await fetch(`/api/e/${p.slug}/stats`).catch(() => null);
    if (!r?.ok) return;
    const st = (await r.json()) as Stats;
    statsRef.current = st.photos;
    // Cheer when one of my missions just got done (and louder when that was the last one).
    const before = doneRef.current;
    const fresh = st.missionsDone.filter((id) => !before.has(id));
    doneRef.current = new Set(st.missionsDone);
    if (fresh.length && st.missions.length) {
      const allDone = st.missions.every((m) => doneRef.current.has(m.id));
      if (allDone) {
        confetti({ particleCount: 220, spread: 110, origin: { y: 0.6 }, colors: ["#ffb703", "#fb8500", ...CHEER], disableForReducedMotion: true });
        flash(`🏆 Mission Master! You finished all ${st.missions.length} missions`);
      } else {
        const m = st.missions.find((x) => x.id === fresh[0]);
        flash(`✅ Mission complete: ${m?.title ?? "nice!"}`);
      }
    }
    setStats(st);
  }, [p.slug, flash]);
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
    // Same for every package: the best quality that still uploads fast.
    quality: { maxPx: PHOTO_MAX_PX, jpeg: Math.round(PHOTO_JPEG * 100) },
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
      confetti({ particleCount: 110, spread: 75, origin: { y: 0.8 }, colors: CHEER, disableForReducedMotion: true });
      flash(ok === 1 ? `Shared! You're snap #${statsRef.current + 1} 🎉` : `${ok} photos shared! 🎉`);
    },
  });

  // Photos just shared show straight away as tiles until the real photo is in the gallery.
  const inGallery = useMemo(() => new Set(all.photos.map((x) => x.id)), [all.photos]);
  const [now, setNow] = useState(0);
  const pending: PendingTile[] = up.items.filter((i) => i.status !== "error" && !(i.photoId && inGallery.has(i.photoId)) && !(i.doneAt && now - i.doneAt > 60_000));
  // Other guests' uploads (from the album pulse) show as tiles too, so everyone sees the buzz.
  const [others, setOthers] = useState<{ guest: string | null; name: string | null; n: number }[]>([]);
  const otherTiles: PendingTile[] = others.flatMap((u) =>
    Array.from({ length: Math.min(u.n, 3) }, (_, i) => ({ key: `o-${u.guest}-${i}`, status: "uploading", progress: 0, by: u.name })),
  ).slice(0, 6);
  const tiles = [...pending, ...otherTiles];
  const processing = pending.some((i) => i.status === "done");
  const pollAll = all.poll;
  const meRef = useRef<string | null>(p.guest?.id ?? null);
  useEffect(() => {
    meRef.current = joined?.id ?? null;
  }, [joined]);
  const latestRef = useRef<string | null>(null);
  useEffect(() => {
    const tick = async () => {
      if (document.hidden) return;
      const r = await fetch(`/api/e/${p.slug}/pulse`).catch(() => null);
      if (!r?.ok) return;
      const b = (await r.json()) as { latest: string | null; uploading: { guest: string | null; name: string | null; n: number }[] };
      setOthers(b.uploading.filter((u) => u.guest !== meRef.current));
      if (b.latest && b.latest !== latestRef.current) {
        // A new photo landed somewhere: fetch it now instead of waiting for the slow poll.
        if (latestRef.current) {
          pollAll();
          loadStats();
        }
        latestRef.current = b.latest;
      }
    };
    const first = setTimeout(tick, 1000);
    const t = setInterval(tick, 5000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [p.slug, pollAll, loadStats]);
  useEffect(() => {
    if (!processing) return;
    const t = setInterval(() => {
      pollAll();
      setNow(Date.now());
    }, 2500);
    return () => clearInterval(t);
  }, [processing, pollAll]);

  // The home-screen app opens with ?k=…: sign this browser in as that guest once.
  useEffect(() => {
    const k = new URLSearchParams(location.search).get("k");
    if (!k) return;
    if (joined) history.replaceState(history.state, "", location.pathname);
    else location.replace(`${p.base}/resume?k=${encodeURIComponent(k)}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The installed app should start signed in as this guest.
  useEffect(() => {
    if (!key) return;
    document.querySelector('link[rel="manifest"]')?.setAttribute("href", `${p.base}/manifest.webmanifest?k=${encodeURIComponent(key)}`);
  }, [key, p.base]);

  // On a phone, once they've joined: suggest adding the album to the home screen (once per album).
  // After joining, so the installed app starts signed in as them.
  const isIn = !!joined;
  useEffect(() => {
    const pl = install.platform;
    if (!isIn || !pl || pl === "standalone" || pl === "desktop" || store(`pc-install-${p.slug}`)) return;
    let tries = 0;
    const t = setInterval(() => {
      // Wait until nothing else is on screen (join sheet, camera, review…).
      if (document.querySelector('[role="dialog"]') && ++tries < 40) return;
      clearInterval(t);
      store(`pc-install-${p.slug}`, "1");
      setSheet((s) => s ?? "install");
    }, 2000);
    return () => clearInterval(t);
  }, [install.platform, p.slug, isIn]);

  // iOS "Add to Home Screen" saves the current address, so carry the session in it while the guide is open.
  useEffect(() => {
    if (sheet !== "install" || install.platform !== "ios" || !key) return;
    history.replaceState(history.state, "", `${location.pathname}?k=${encodeURIComponent(key)}`);
    return () => history.replaceState(history.state, "", location.pathname);
  }, [sheet, install.platform, key]);

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
    (g: { id: string; name: string | null; uploaded: number; key: string | null; avatar?: string | null }) => {
      setJoined({ id: g.id, name: g.name, uploaded: g.uploaded, blocked: false, avatar: g.avatar ?? null });
      if (g.avatar) setPeopleKey((k) => k + 1);
      if (g.key) setKey(g.key);
      const next = joinFor;
      setJoinFor(null);
      if (!next || next.kind === "join") return;
      if (next.kind === "wish") return void setTimeout(() => setWishOpen(true), 50);
      // Android still counts the "Let's go" tap and opens the camera/picker; iOS needs one more tap.
      if (next.kind === "camera" && f.camera) {
        setMission(next.mission ?? null);
        setTimeout(() => setCameraOpen(true), 50);
      } else if (next.kind === "upload") {
        pick.current?.click();
        flash("You're in! Tap Upload to pick your photos 📸");
      }
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
  const goTab = (t: Tab) => {
    setAlbum(null);
    setTab(t);
    scrollToTabs();
  };
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
  const snapMission = (id: string) => (canShoot ? start(f.camera ? "camera" : "upload", id) : openMission(missionMap.get(id)!));

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
    // Show the newest-first gallery, where the just-shared photos appear as uploading tiles.
    setOrder("new");
    goTab("all");
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
  const viewerAt = open ? viewerList.findIndex((x) => x.id === open.id) : -1;
  const busy = up.items.filter((i) => i.status !== "done" && i.status !== "error").length;
  const failed = up.items.filter((i) => i.status === "error");
  const tabs: { id: Tab; label: string; show: boolean }[] = [
    { id: "highlights", label: "Highlights", show: true },
    { id: "missions", label: "Missions", show: hasMissions },
    { id: "people", label: "People", show: true },
    { id: "all", label: "All Photos", show: true },
    { id: "top", label: "Top Snappers", show: f.voting },
    { id: "wishes", label: "Wishes", show: f.wishes },
  ];
  // Highlights albums, all the same size: Most loved, then hashtags, then missions.
  type AlbumTile = { k: string; title: string; emoji: string | null; sub: string; cover: string | null };
  const albums: AlbumTile[] = [
    ...(f.voting && stats.topPhotos.length ? [{ k: "top", title: "Most loved", emoji: null, sub: `${stats.topPhotos[0].votes} ❤️ on the top photo`, cover: stats.topPhotos[0].md }] : []),
    ...(f.tags ? stats.tagAlbums.map((a) => ({ k: `t:${a.tag}`, title: `#${a.tag}`, emoji: null, sub: `${a.count} photo${a.count === 1 ? "" : "s"}`, cover: a.cover })) : []),
    ...(hasMissions
      ? stats.missions.filter((m) => m.count).map((m) => ({ k: `m:${m.id}`, title: m.title, emoji: m.emoji ?? "🎯", sub: `${m.count} photo${m.count === 1 ? "" : "s"}`, cover: m.cover ?? null }))
      : []),
  ];
  // Best moments: the most loved photos, or the newest ones before anyone hearts.
  const moments: Moment[] =
    f.voting && stats.topPhotos.length
      ? stats.topPhotos.map((t) => ({ id: t.id, src: t.md, by: t.by, votes: t.votes }))
      : all.photos.filter((x) => x.status === "ready").slice(0, 6).map((x) => ({ id: x.id, src: x.md, by: x.by, votes: x.votes }));
  const openMoment = (id: string) => (all.photos.some((x) => x.id === id) ? setOpen({ list: "all", id }) : openTop());
  const openTile = (k: string) => {
    if (k === "top") return openTop();
    if (k.startsWith("t:")) return openTag(k.slice(2));
    const m = missionMap.get(k.slice(2));
    if (m) openMission(m);
  };

  return (
    <div style={style} className="min-h-dvh bg-paper pb-36">
      {p.hostUrl ? (
        <div className="bg-ink px-4 py-2 text-white">
          <div className="mx-auto flex max-w-3xl items-center gap-3 text-sm">
            <span className="min-w-0 flex-1">
              <strong>Guest view.</strong> <span className="text-white/75">This is what your guests see — snap and upload here too.</span>
            </span>
            <a href={p.hostUrl} className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-bold text-ink">
              Host dashboard
            </a>
          </div>
        </div>
      ) : null}
      {/* ------------------------------------------------------------ top bar */}
      <header className="sticky top-0 z-30 border-b border-black/5 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-3 px-4">
          {p.event.logo ? <img src={p.event.logo} alt="" className="h-8 w-auto" /> : <Logo className="text-lg" />}
          {joined ? (
            <button type="button" onClick={() => setSheet("you")} className="flex min-w-0 items-center gap-2 rounded-full bg-muted py-1 pl-1 pr-3 text-sm font-semibold" aria-label={`You: ${joined.name ?? "Guest"}`}>
              {joined.avatar ? (
                <img src={joined.avatar} alt="" className="size-7 shrink-0 rounded-full object-cover" />
              ) : (
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand text-xs font-bold text-white">{initial(joined.name)}</span>
              )}
              <span className="min-w-0 max-w-32 truncate">{joined.name ?? "You"}</span>
              {master ? <span title="Mission Master">🏆</span> : null}
            </button>
          ) : p.canUpload ? (
            <button type="button" onClick={() => setJoinFor({ kind: "join" })} className="rounded-full bg-brand px-4 py-1.5 text-sm font-bold text-white shadow-cherry">
              Join
            </button>
          ) : null}
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

      {/* ------------------------------------------------------------ tabs (scroll sideways on small phones) */}
      <div ref={tabsRef} className="scroll-mt-14" />
      <nav className="sticky top-14 z-20 mt-4 border-b border-border bg-paper/95 backdrop-blur" aria-label="Sections">
        <div className="relative mx-auto max-w-3xl">
          <div className="no-scrollbar flex gap-1 overflow-x-auto px-3 pr-8">
            {tabs
              .filter((t) => t.show)
              .map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={(e) => {
                    setAlbum(null);
                    setTab(t.id);
                    e.currentTarget.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
                  }}
                  aria-current={tab === t.id && !album ? "page" : undefined}
                  className={`-mb-px shrink-0 border-b-2 px-3 py-3 text-sm font-semibold ${tab === t.id && !album ? "border-brand text-brand" : "border-transparent text-muted-foreground"}`}
                >
                  {t.label}
                </button>
              ))}
          </div>
          <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-paper to-transparent" aria-hidden />
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
            {album.person && hasMissions ? (
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
            <Masonry gallery={albumGallery} missions={missionMap} onOpen={(i) => setOpen({ list: "album", id: albumGallery.photos[i].id })} empty="Nothing here yet." />
          </section>
        ) : tab === "highlights" ? (
          <div className="grid gap-4 px-2">
            {p.event.ended ? (
              <Link href={`${p.base}/recap`} className="flex items-center gap-3 rounded-3xl bg-ink p-4 text-white shadow-lift">
                <span className="text-3xl">✨</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold">The recap is ready</span>
                  <span className="block text-sm text-white/70">The whole day in numbers, the most loved photos and every wish.</span>
                </span>
                <ArrowRight className="size-5 shrink-0" aria-hidden />
              </Link>
            ) : null}
            <Stories people={people ?? []} me={joined?.id ?? null} onOpen={openPerson} onAdd={canShoot && !(joined && shotsLeft <= 0) ? () => start(f.camera ? "camera" : "upload") : null} />
            <BestMoments title={f.voting && stats.topPhotos.length ? "Best moments" : "Fresh moments"} moments={moments} onOpen={openMoment} onAll={() => (f.voting && stats.topPhotos.length ? openTop() : goTab("all"))} />
            {hasMissions ? <MissionsProgress missions={stats.missions} done={done} canShoot={canShoot} onPick={snapMission} onAll={() => goTab("missions")} /> : null}
            {albums.length ? (
              <section>
                <h3 className="mb-2.5 px-1 text-lg font-extrabold">Albums</h3>
                <div className="grid grid-cols-2 gap-3">
                  {albums.map((a) => (
                    <AlbumCard key={a.k} title={a.title} emoji={a.emoji} subtitle={a.sub} cover={a.cover} onClick={() => openTile(a.k)} />
                  ))}
                </div>
              </section>
            ) : null}
            {f.tags && !stats.tagAlbums.length ? (
              <section className="rounded-3xl border-2 border-dashed border-brand/25 bg-white p-5 text-center">
                <div className="text-3xl">#️⃣</div>
                <h3 className="mt-1 font-bold">Hashtag albums appear here</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  When you share a photo, tap a hashtag like <strong className="text-brand">#{p.suggestedTags[0] ?? "reception"}</strong> or <strong className="text-brand">#{p.suggestedTags[1] ?? "family"}</strong> — every hashtag becomes an album.
                </p>
              </section>
            ) : null}
            <section>
              <div className="mb-3 flex items-center justify-between px-1">
                <h3 className="inline-flex items-center gap-2 text-lg font-extrabold">
                  <span className="relative flex size-2.5">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand opacity-60" />
                    <span className="relative inline-flex size-2.5 rounded-full bg-brand" />
                  </span>
                  Live feed
                </h3>
                <button type="button" onClick={() => goTab("all")} className="inline-flex items-center gap-1 text-sm font-semibold text-brand">
                  All photos <ArrowRight className="size-4" aria-hidden />
                </button>
              </div>
              <Masonry gallery={{ ...all, photos: all.photos.slice(0, 12), next: null }} pending={tiles} missions={missionMap} onOpen={(i) => setOpen({ list: "all", id: all.photos[i].id })} empty="No photos yet — be the first to snap one!" />
            </section>
          </div>
        ) : tab === "missions" && hasMissions ? (
          <MissionsPanel missions={stats.missions} done={done} board={board} me={joined?.id ?? null} canShoot={canShoot} onSnap={snapMission} onOpen={openMission} />
        ) : tab === "people" ? (
          <div className="px-2">
            <h2 className="mb-1 text-2xl font-extrabold">Browse by people</h2>
            <p className="mb-4 text-sm text-muted-foreground">See who captured the moments.</p>
            <PeopleGrid people={people} onOpen={openPerson} />
          </div>
        ) : tab === "top" && f.voting ? (
          <TopPanel
            snappers={stats.topSnappers}
            topPhotos={stats.topPhotos}
            me={joined?.id ?? null}
            voting={f.voting}
            onTop={openTop}
            onPerson={(s) => openPerson(people?.find((x) => x.id === s.id) ?? { id: s.id, name: s.name, count: s.count, cover: null, hearts: 0 })}
          />
        ) : tab === "wishes" && f.wishes ? (
          <div className="px-2">
            <WishesPanel slug={p.slug} canWrite={!joined?.blocked && p.canUpload} onWrite={() => start("wish")} refreshKey={wishKey} />
          </div>
        ) : (
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
            <Masonry gallery={all} pending={order === "new" ? tiles : undefined} missions={missionMap} onOpen={(i) => setOpen({ list: "all", id: all.photos[i].id })} empty="No photos yet — be the first to snap one!" />
          </section>
        )}
      </main>

      {p.event.poweredBy ? (
        <footer className="mt-12 flex justify-center">
          <a href="https://pixcherry.com" className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            Made with <Logo className="text-xs" />
          </a>
        </footer>
      ) : null}

      {/* ------------------------------------------------------------ bottom menu (one place for every action) */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur" aria-label="Actions">
        <div className={`mx-auto grid max-w-md items-end px-1 pt-1.5 ${f.camera ? "grid-cols-5" : "grid-cols-4"}`}>
          <BarButton icon={Images} label="All Photos" onClick={() => goTab("all")} />
          <BarButton icon={ImagePlus} label="Upload" onClick={() => start("upload")} disabled={!canShoot || (f.camera && p.event.cameraOnly) || (!!joined && shotsLeft <= 0)} />
          {f.camera ? (
            <button type="button" onClick={() => start("camera")} disabled={!canShoot || (!!joined && shotsLeft <= 0)} className="-mt-6 grid justify-items-center gap-1 pb-1.5 text-[11px] font-bold text-brand disabled:opacity-40" aria-label="Snap">
              <span className="grid size-14 place-items-center rounded-full border-4 border-white bg-brand text-white shadow-cherry">
                <Camera className="size-6" aria-hidden />
              </span>
              Snap
            </button>
          ) : null}
          <BarButton icon={MessageCircleHeart} label="Wishes" onClick={() => (f.wishes ? (canShoot ? start("wish") : goTab("wishes")) : undefined)} disabled={!f.wishes} />
          <BarButton icon={MoreHorizontal} label="More" onClick={() => setSheet("more")} />
        </div>
      </nav>

      <Sheet open={sheet === "more"} onClose={() => setSheet(null)} title="More">
        <div className="grid gap-2">
          <MoreItem icon={QrCode} label="Show QR code" onClick={() => setSheet("qr")} />
          {install.platform && install.platform !== "standalone" ? <MoreItem icon={Smartphone} label="Add to home screen" onClick={() => setSheet("install")} /> : null}
          {f.slideshow ? <MoreItem icon={MonitorPlay} label="Play slideshow" href={`${p.base}/slideshow`} /> : null}
          <MoreItem
            icon={Sparkles}
            label="Share my story card"
            onClick={() => {
              setSheet(null);
              shareCard();
            }}
          />
          <MoreItem icon={PartyPopper} label="Event recap" href={`${p.base}/recap`} />
          <MoreItem
            icon={User}
            label="My photos"
            onClick={() => {
              setSheet(null);
              if (joined) myPhotos();
              else setJoinFor({ kind: "join" });
            }}
          />
          {f.albumDownload ? <MoreItem icon={Download} label="Download the whole album" href={`/api/e/${p.slug}/album`} /> : null}
          <MoreItem
            icon={Share2}
            label="Share this album"
            onClick={() => {
              setSheet(null);
              if (navigator.share) navigator.share({ title: p.event.name, url: p.shareUrl }).catch(() => {});
              else navigator.clipboard?.writeText(p.shareUrl).then(() => flash("Link copied ✨"));
            }}
          />
        </div>
      </Sheet>

      <Sheet open={sheet === "qr"} onClose={() => setSheet(null)} title="Scan to join">
        <div className="grid justify-items-center gap-3 text-center">
          <div className="w-full max-w-64 rounded-3xl bg-white p-3 shadow-soft ring-1 ring-border [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: p.qrSvg }} />
          <div>
            <div className="font-bold">{p.event.name}</div>
            <div className="text-sm font-semibold text-brand">{p.shareUrl.replace(/^https?:\/\//, "")}</div>
          </div>
          <p className="text-sm text-muted-foreground">Show this to friends so they can join and share their photos too.</p>
        </div>
      </Sheet>

      <Sheet open={sheet === "install"} onClose={() => setSheet(null)} title="📲 Keep this album on your phone">
        {install.platform ? (
          <InstallGuide
            platform={install.platform}
            canPrompt={install.canPrompt}
            link={p.shareUrl}
            onInstall={async () => {
              if (await install.install()) {
                setSheet(null);
                flash("Added! Find PixCherry on your home screen 📲");
              }
            }}
            onDone={() => setSheet(null)}
          />
        ) : null}
      </Sheet>

      <Sheet open={sheet === "you" && !!joined} onClose={() => setSheet(null)} title="You">
        {joined ? (
          <YouPanel
            slug={p.slug}
            joined={joined}
            onAvatar={(avatar) => {
              setJoined({ ...joined, avatar });
              setPeopleKey((k) => k + 1);
              flash("Selfie updated 📸");
            }}
            onRenamed={(name) => {
              setJoined({ ...joined, name });
              setPeopleKey((k) => k + 1);
              flash("Name updated ✨");
            }}
            shotsLeft={canShoot ? shotsLeft : null}
            missions={hasMissions ? { done: stats.missions.filter((m) => done.has(m.id)).length, total: stats.missions.length } : null}
            onMyPhotos={() => {
              setSheet(null);
              myPhotos();
            }}
            onMissions={() => {
              setSheet(null);
              goTab("missions");
            }}
            onInstall={install.platform && install.platform !== "standalone" ? () => setSheet("install") : null}
          />
        ) : null}
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
        <div className="fixed inset-x-0 bottom-28 z-[80] flex justify-center px-4" role="status">
          <div key={toast} className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white shadow-lift [animation:pc-pop_3.5s_ease_forwards]">{toast}</div>
        </div>
      ) : null}

      {cameraOpen ? (
        <PixCamera
          onClose={() => setCameraOpen(false)}
          onShot={(file, extra) => up.add([file], { mission, prepared: true, tags: extra.tags, caption: extra.caption })}
          onFallback={() => {
            history.back();
            snap.current?.click();
          }}
          shotsLeft={shotsLeft}
          maxBytes={p.limits.maxBytes}
          missions={hasMissions ? stats.missions : []}
          mission={mission}
          onMission={setMission}
          suggestedTags={f.tags ? p.suggestedTags : null}
          eventName={p.event.name}
        />
      ) : null}
      {/* Fallback: the phone's own camera app, then "develop" adds the look. */}
      <input
        ref={snap}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        aria-label="Take a photo"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) setShot(file);
        }}
      />
      {shot ? (
        <Develop
          key={shot.name + shot.lastModified}
          file={shot}
          onClose={() => setShot(null)}
          onRetake={() => snap.current?.click()}
          onShare={(file, extra) => {
            up.add([file], { mission, prepared: true, tags: extra.tags, caption: extra.caption });
            history.back();
            setOrder("new");
            goTab("all");
          }}
          shotsLeft={shotsLeft}
          maxBytes={p.limits.maxBytes}
          missions={hasMissions ? stats.missions : []}
          mission={mission}
          onMission={setMission}
          suggestedTags={f.tags ? p.suggestedTags : null}
          eventName={p.event.name}
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
          missions={hasMissions ? stats.missions : []}
          mission={pickMissionId}
          onMission={setPickMissionId}
          left={shotsLeft}
          tags={f.tags ? { suggested: p.suggestedTags, value: pickTags, onChange: setPickTags } : null}
        />
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

      {open !== null && viewerAt >= 0 ? (
        <Viewer
          slug={p.slug}
          photos={viewerList}
          index={viewerAt}
          total={open.list === "all" ? stats.photos : undefined}
          onIndex={(i) => {
            setOpen({ ...open, id: viewerList[i].id });
            if (i >= viewerList.length - 3) (open.list === "album" ? albumGallery : all).more();
          }}
          onClose={() => setOpen(null)}
          voting={f.voting}
          onVote={vote}
          missions={missionMap}
          onCaption={
            joined && !joined.blocked
              ? (id, caption) => {
                  all.patchPhoto(id, { caption });
                  albumGallery.patchPhoto(id, { caption });
                }
              : undefined
          }
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

      {p.canUpload ? <Welcome slug={p.slug} eventName={p.event.name} missions={hasMissions} joined={!!joined} onJoin={() => setJoinFor({ kind: "join" })} /> : null}
      {/* After the viewer so joining shows on top of it. */}
      <Sheet open={!!joinFor} onClose={() => setJoinFor(null)} title="Join the album" top>
        <JoinForm slug={p.slug} askName={p.event.askName} siteKey={p.siteKey} onJoined={onJoined} canUpload={p.canUpload} />
      </Sheet>
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
  onJoined: (j: NonNullable<JoinState["joined"]> & { avatar?: string | null }) => void;
  canUpload: boolean;
}) {
  const [selfie, setSelfie] = useState<{ blob: Blob; url: string } | null>(null);
  // Controlled fields + a manual submit: a failed attempt (e.g. the bot check not
  // finished yet) must never wipe the name the guest already typed.
  const [name, setName] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [slow, setSlow] = useState(false);
  const [tick, setTick] = useState(false);
  const [widget, setWidget] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [match, setMatch] = useState<JoinState["match"] | null>(null);
  const [device, setDevice] = useState("");
  const [taken, setTaken] = useState<JoinState["nameTaken"] | null>(null);
  const [busy, startBusy] = useTransition();
  useEffect(() => {
    deviceSignals().then((d) => setDevice(d ? JSON.stringify(d) : ""));
  }, []);
  useEffect(() => {
    if (!siteKey) return;
    // If the check never finishes (blocked script), let them try anyway; the server decides.
    const t = setTimeout(() => setSlow(true), 8000);
    return () => clearTimeout(t);
  }, [siteKey, widget]);
  if (!canUpload) return <p className="text-sm text-muted-foreground">This album is closed for new photos and wishes.</p>;
  // Waiting for the bot check; if it asks for a tick, wait for that (never submit without it).
  const waiting = !!siteKey && !token && (!slow || tick);
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // The "Yes, that's me" / "No" buttons carry name="same".
    const fd = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
    setError(null);
    startBusy(async () => {
      const r = await join(slug, {}, fd);
      if (r.joined) {
        // The selfie goes up once they're in (it needs the guest session).
        const avatar = selfie ? await uploadSelfie(slug, selfie.blob) : null;
        return onJoined({ ...r.joined, avatar });
      }
      if (r.nameTaken) {
        setMatch(null);
        return setTaken(r.nameTaken);
      }
      if (r.match && !r.error) return setMatch(r.match);
      if (r.match) setMatch(r.match);
      setError(r.error ?? "Something went wrong. Please try again.");
      if (siteKey) {
        // Tokens are single use: get a fresh one for the next try.
        setToken(null);
        setSlow(false);
        setTick(false);
        setWidget((w) => w + 1);
      }
    });
  };
  return (
    <form onSubmit={submit} className="grid gap-3">
      <p className="text-sm text-muted-foreground">One tap and you&apos;re in — no app, no password.</p>
      {askName ? (
        <div className="flex items-end gap-3">
          <div className="grid justify-items-center gap-1">
            <SelfieButton preview={selfie?.url ?? null} onPick={(blob, url) => setSelfie({ blob, url })} label="Add a selfie (optional)" />
            <span className="text-[10px] font-semibold text-muted-foreground">Selfie</span>
          </div>
          <label className="grid min-w-0 flex-1 gap-1.5">
            <span className="text-sm font-semibold">Your name</span>
            <input
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              autoComplete="name"
              autoFocus
              placeholder="So everyone knows who snapped it"
              className="h-12 rounded-2xl border border-input bg-background px-4 outline-none focus:border-brand"
            />
          </label>
        </div>
      ) : null}
      {askName ? <p className="-mt-1 text-xs text-muted-foreground">Add a selfie so the hosts know whose photos are whose (optional).</p> : null}
      {taken && taken.name.toLowerCase() === name.trim().toLowerCase() ? (
        <NameTaken
          message={`Someone here is already called ${taken.name}. Add your surname or a nickname so friends can tell you apart.`}
          suggestion={taken.suggestion}
          onPick={(v) => {
            setName(v);
            setTaken(null);
          }}
        />
      ) : null}
      {siteKey ? <Turnstile key={widget} siteKey={siteKey} onToken={setToken} onInteractive={() => setTick(true)} /> : null}
      {error ? <p className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p> : null}
      <input type="hidden" name="device" value={device} />
      {match && (match.byDevice || (match.name ?? "").toLowerCase() === name.trim().toLowerCase()) ? (
        <div className="grid gap-2 rounded-2xl bg-brand-soft p-4" role="group" aria-label="Welcome back">
          {match.strict ? (
            <p className="text-sm">
              <strong>📱 This phone is already in the album as {match.name ?? "a guest"}</strong>
              {match.photos ? ` (${match.photos} photo${match.photos === 1 ? "" : "s"})` : ""}. One phone, one roll — carry on where you left off.
            </p>
          ) : (
            <p className="text-sm">
              <strong>Welcome back{match.name ? `, ${match.name}` : ""}! 👋</strong> {match.byDevice ? "This phone already joined" : `Someone called ${match.name} already joined from this phone`}
              {match.photos ? ` with ${match.photos} photo${match.photos === 1 ? "" : "s"}` : ""}. Is that you?
            </p>
          )}
          <button name="same" value={`yes:${match.id}`} disabled={busy || waiting} className="inline-flex items-center justify-center gap-2 rounded-full bg-brand py-3 font-bold text-white shadow-cherry disabled:opacity-60">
            {busy ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
            {match.strict ? "Continue" : "Yes, continue"} as {match.name ?? "that guest"}
          </button>
          {match.strict ? (
            <p className="text-xs text-muted-foreground">Not you? Someone with the same phone model on the same Wi-Fi can switch to mobile data and try again, or ask the hosts.</p>
          ) : (
            <button name="same" value="new" disabled={busy || waiting} className="py-1.5 text-sm font-semibold text-muted-foreground">
              No, I&apos;m someone else
            </button>
          )}
        </div>
      ) : (
        <button disabled={busy || waiting} className="inline-flex items-center justify-center gap-2 rounded-full bg-brand py-3.5 font-bold text-white shadow-cherry disabled:opacity-60">
          {busy || waiting ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
          {waiting ? (tick ? "Tick the box above first" : "Just a moment…") : "Let's go 🎉"}
        </button>
      )}
    </form>
  );
}

function YouPanel({
  slug,
  joined,
  onAvatar,
  onRenamed,
  shotsLeft,
  missions,
  onMyPhotos,
  onMissions,
  onInstall,
}: {
  slug: string;
  joined: Joined;
  onAvatar: (url: string) => void;
  onRenamed: (name: string | null) => void;
  shotsLeft: number | null;
  missions: { done: number; total: number } | null;
  onMyPhotos: () => void;
  onMissions: () => void;
  onInstall: (() => void) | null;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(joined.name ?? "");
  const [clash, setClash] = useState<{ error: string; suggestion: string | null } | null>(null);
  const [busy, startBusy] = useTransition();
  const save = () =>
    startBusy(async () => {
      const r = await rename(slug, name);
      if (r.error) return setClash({ error: r.error, suggestion: r.suggestion ?? null });
      setClash(null);
      setEditing(false);
      onRenamed(r.name ?? null);
    });
  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-4">
        <SelfieButton
          size="lg"
          preview={joined.avatar ?? null}
          label={joined.avatar ? "Change your selfie" : "Add a selfie"}
          onPick={async (blob) => {
            const url = await uploadSelfie(slug, blob);
            if (url) onAvatar(url);
          }}
        />
        {editing ? (
          <div className="flex min-w-0 flex-1 gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoFocus aria-label="Your name" className="h-11 min-w-0 flex-1 rounded-2xl border border-input bg-background px-3 outline-none focus:border-brand" />
            <button type="button" onClick={save} disabled={busy} className="rounded-full bg-brand px-4 text-sm font-bold text-white disabled:opacity-60">
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : "Save"}
            </button>
          </div>
        ) : (
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">You&apos;re in as</div>
            <div className="flex items-center gap-2">
              <span className="truncate text-xl font-extrabold">{joined.name ?? "Guest"}</span>
              <button type="button" onClick={() => setEditing(true)} className="grid size-8 shrink-0 place-items-center rounded-full bg-muted" aria-label="Edit name">
                <Pencil className="size-4" aria-hidden />
              </button>
            </div>
            <div className="text-xs text-muted-foreground">Shown next to your photos and wishes.</div>
          </div>
        )}
      </div>
      {editing && clash ? (
        <NameTaken
          message={clash.error}
          suggestion={clash.suggestion}
          onPick={(v) => {
            setName(v);
            setClash(null);
          }}
        />
      ) : null}
      <div className="grid grid-cols-2 gap-2 text-center">
        {shotsLeft !== null ? (
          <div className="rounded-2xl bg-background p-3">
            <div className="text-2xl font-extrabold">{shotsLeft}</div>
            <div className="text-xs text-muted-foreground">shots left</div>
          </div>
        ) : null}
        {missions ? (
          <button type="button" onClick={onMissions} className="rounded-2xl bg-background p-3">
            <div className="text-2xl font-extrabold">
              {missions.done === missions.total ? "🏆" : `${missions.done}/${missions.total}`}
            </div>
            <div className="text-xs text-muted-foreground">{missions.done === missions.total ? "Mission Master" : "missions done"}</div>
          </button>
        ) : null}
      </div>
      <div className="grid gap-2">
        <MoreItem icon={User} label="My photos" onClick={onMyPhotos} />
        {onInstall ? <MoreItem icon={Smartphone} label="Add to home screen" onClick={onInstall} /> : null}
      </div>
    </div>
  );
}

function NameTaken({ message, suggestion, onPick }: { message: string; suggestion: string | null; onPick: (name: string) => void }) {
  return (
    <div className="grid gap-2 rounded-2xl bg-warn-soft px-3 py-2.5 text-sm text-warn" role="alert">
      <p>{message}</p>
      {suggestion ? (
        <button type="button" onClick={() => onPick(suggestion)} className="justify-self-start rounded-full bg-white px-3 py-1 text-xs font-bold text-ink shadow-soft">
          Use “{suggestion}”
        </button>
      ) : null}
    </div>
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
