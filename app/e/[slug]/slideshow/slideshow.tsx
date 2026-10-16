"use client";

import { useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { Maximize } from "lucide-react";
import { LogoMark } from "@/components/brand";
import type { GalleryPhoto } from "@/lib/photos";

// Big-screen show. A small director picks the next "scene": a Ken Burns photo
// (varied transitions), a polaroid drop for photos that were just shared (with
// confetti), a 4-photo collage, or a wish spotlight. Live counters, QR and the
// leaderboard stay on screen.

const SHOW_MS = 6500;
const POLL_MS = 8000;
const STATS_MS = 20_000;

type Stats = { photos: number; guests: number; topSnappers: { id: string; name: string | null; count: number }[]; missions: { id: string; title: string; emoji: string | null }[] };
type Wish = { id: string; name: string | null; message: string };
type Scene =
  | { kind: "photo"; photo: GalleryPhoto; fx: number; key: string }
  | { kind: "fresh"; photo: GalleryPhoto; key: string }
  | { kind: "collage"; photos: GalleryPhoto[]; key: string }
  | { kind: "wish"; wish: Wish; bg: GalleryPhoto | null; key: string };

const ENTER = ["pc-ss-fade", "pc-ss-zoom", "pc-ss-slide", "pc-ss-tilt"];
const KB = ["pc-kb-1", "pc-kb-2", "pc-kb-3", "pc-kb-4"];

function useCountUp(target: number) {
  const [n, setN] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const start = from.current;
    if (start === target) return;
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / 900);
      setN(Math.round(start + (target - start) * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(tick);
      else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return n;
}

export function Slideshow({ slug, name, qrSvg, voting, wishes: wishesOn }: { slug: string; name: string; qrSvg: string; voting: boolean; wishes: boolean }) {
  const [scene, setScene] = useState<Scene | null>(null);
  const [stats, setStats] = useState<Stats>({ photos: 0, guests: 0, topSnappers: [], missions: [] });
  const [wishes, setWishes] = useState<Wish[]>([]);
  const pool = useRef<GalleryPhoto[]>([]);
  const fresh = useRef<GalleryPhoto[]>([]);
  const wishQueue = useRef<Wish[]>([]);
  const seenWishes = useRef(new Set<string>());
  const pos = useRef(0);
  const beat = useRef(0);
  const latest = useRef<string | null>(null);
  const photos = useCountUp(stats.photos);
  const guests = useCountUp(stats.guests);

  useEffect(() => {
    let stop = false;
    const fetchPhotos = async (since: string | null) => {
      const u = new URLSearchParams({ order: "new", limit: since ? "100" : "200" });
      if (since) u.set("since", since);
      const r = await fetch(`/api/e/${slug}/photos?${u}`).catch(() => null);
      if (!r?.ok) return;
      const b = (await r.json()) as { photos: GalleryPhoto[] };
      const ready = b.photos.filter((p) => p.status === "ready");
      if (!ready.length) return;
      latest.current = ready[0].at;
      if (since) fresh.current.push(...ready.reverse());
      else pool.current = ready;
    };
    const loadStats = async () => {
      const r = await fetch(`/api/e/${slug}/stats`).catch(() => null);
      if (r?.ok) setStats((await r.json()) as Stats);
    };
    const loadWishes = async () => {
      if (!wishesOn) return;
      const r = await fetch(`/api/e/${slug}/wishes`).catch(() => null);
      if (!r?.ok) return;
      const list = ((await r.json()) as { wishes: Wish[] }).wishes;
      setWishes(list.slice(0, 30));
      for (const w of list.slice().reverse()) {
        if (!seenWishes.current.has(w.id)) {
          seenWishes.current.add(w.id);
          wishQueue.current.push(w);
        }
      }
    };
    const randomPhoto = () => pool.current[Math.floor(Math.random() * pool.current.length)] ?? null;
    const next = () => {
      beat.current++;
      const n = fresh.current.shift();
      if (n) {
        pool.current = [n, ...pool.current.filter((p) => p.id !== n.id)].slice(0, 500);
        pos.current = 0;
        setScene({ kind: "fresh", photo: n, key: `f-${n.id}` });
        confetti({ particleCount: 140, spread: 90, origin: { y: 0.35 }, colors: ["#e91d48", "#ffd166", "#ffffff", "#16a34a"], disableForReducedMotion: true });
        return;
      }
      if (wishQueue.current.length && beat.current % 4 === 0) {
        const w = wishQueue.current.shift()!;
        return setScene({ kind: "wish", wish: w, bg: randomPhoto(), key: `w-${w.id}-${beat.current}` });
      }
      if (pool.current.length >= 4 && beat.current % 6 === 0) {
        const start = (pos.current + 1) % pool.current.length;
        const four = [0, 1, 2, 3].map((i) => pool.current[(start + i) % pool.current.length]);
        pos.current = (start + 3) % pool.current.length;
        return setScene({ kind: "collage", photos: four, key: `c-${beat.current}` });
      }
      if (!pool.current.length) return;
      pos.current = (pos.current + 1) % pool.current.length;
      const ph = pool.current[pos.current];
      setScene({ kind: "photo", photo: ph, fx: beat.current, key: `p-${ph.id}-${beat.current}` });
    };
    Promise.all([fetchPhotos(null), loadStats(), loadWishes()]).then(() => !stop && next());
    const t1 = setInterval(next, SHOW_MS);
    const t2 = setInterval(() => fetchPhotos(latest.current), POLL_MS);
    const t3 = setInterval(() => {
      loadStats();
      loadWishes();
    }, STATS_MS);
    return () => {
      stop = true;
      clearInterval(t1);
      clearInterval(t2);
      clearInterval(t3);
    };
  }, [slug, wishesOn]);

  const mission = (ph: GalleryPhoto) => (ph.mission ? stats.missions.find((m) => m.id === ph.mission) : null);
  const ticker = wishes.map((w) => `💌 ${w.name ?? "A guest"}: ${w.message.replace(/\s+/g, " ")}`).join("     ·     ");

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#0b0b0d] text-white">
      {!scene ? (
        <div className="grid size-full place-items-center px-10 text-center">
          <div>
            <LogoMark className="mx-auto h-24 w-auto" mono="light" />
            <p className="mt-6 text-3xl font-bold">Waiting for the first photo…</p>
            <p className="mt-2 text-xl text-white/70">Scan the code and start snapping! 📸</p>
          </div>
        </div>
      ) : scene.kind === "photo" ? (
        <div key={scene.key} className="absolute inset-0" style={{ animation: `${ENTER[scene.fx % ENTER.length]} 1s ease both` }}>
          <img src={scene.photo.sm} alt="" className="absolute inset-0 size-full scale-110 object-cover opacity-40 blur-2xl" />
          <img
            src={scene.photo.md}
            alt=""
            className="absolute inset-x-0 bottom-0 top-24 m-auto max-h-[calc(100%-6rem)] max-w-full object-contain sm:top-0 sm:max-h-full"
            style={{ animation: `${KB[scene.fx % KB.length]} ${SHOW_MS + 1000}ms linear both` }}
          />
          <Caption photo={scene.photo} mission={mission(scene.photo)} voting={voting} />
        </div>
      ) : scene.kind === "fresh" ? (
        <div key={scene.key} className="absolute inset-0 grid place-items-center">
          <img src={scene.photo.sm} alt="" className="absolute inset-0 size-full scale-110 object-cover opacity-30 blur-2xl" />
          <div className="relative bg-[#fbf8f1] p-3 pb-14 shadow-2xl sm:p-5 sm:pb-20 [animation:pc-drop_1.1s_cubic-bezier(.2,1.4,.4,1)_both]" style={{ rotate: "-3deg" }}>
            <img src={scene.photo.md} alt="" className="max-h-[52vh] max-w-[80vw] object-contain sm:max-h-[62vh] sm:max-w-[70vw]" />
            <div className="absolute inset-x-0 bottom-3 truncate px-3 text-center font-script text-2xl font-bold text-ink sm:bottom-4 sm:text-4xl">{scene.photo.by ? `by ${scene.photo.by}` : "just shared!"}</div>
          </div>
          <div className="absolute left-1/2 top-28 max-w-[90vw] -translate-x-1/2 truncate rounded-full bg-brand px-5 py-2 text-base font-bold shadow-cherry [animation:pc-pop_6s_ease_forwards] sm:top-8 sm:px-7 sm:py-3 sm:text-2xl">
            📸 {scene.photo.by ? `${scene.photo.by} just shared!` : "New photo!"}
          </div>
        </div>
      ) : scene.kind === "collage" ? (
        <div key={scene.key} className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-2 p-3 pb-20 pt-28 sm:gap-3 sm:p-6 sm:pt-28">
          {scene.photos.map((p, i) => (
            <div key={p.id} className="relative overflow-hidden rounded-3xl bg-black" style={{ animation: `pc-ss-zoom 0.8s ease ${i * 0.18}s both` }}>
              <img src={p.md} alt="" className="size-full object-cover" style={{ animation: `${KB[i % KB.length]} ${SHOW_MS + 1000}ms linear both` }} />
              {p.by ? <span className="absolute bottom-2 left-2 max-w-[90%] truncate rounded-full bg-black/55 px-2.5 py-0.5 text-xs font-semibold sm:bottom-3 sm:left-3 sm:px-3 sm:py-1 sm:text-base">{p.by}</span> : null}
            </div>
          ))}
        </div>
      ) : (
        <div key={scene.key} className="absolute inset-0 grid place-items-center px-4 pt-20 sm:px-16 sm:pt-0">
          {scene.bg ? <img src={scene.bg.sm} alt="" className="absolute inset-0 size-full scale-110 object-cover opacity-25 blur-2xl" /> : null}
          <div className="relative max-w-4xl rounded-[2rem] bg-white/95 px-6 py-8 text-center text-ink shadow-2xl sm:rounded-[2.5rem] sm:px-14 sm:py-12 [animation:pc-ss-zoom_0.9s_ease_both]">
            <div className="text-4xl sm:text-5xl">💌</div>
            <p className="mt-3 line-clamp-6 font-script text-3xl leading-tight sm:mt-4 sm:text-5xl">“{scene.wish.message}”</p>
            <p className="mt-4 text-lg font-bold text-brand sm:mt-6 sm:text-2xl">— {scene.wish.name ?? "A guest"}</p>
          </div>
        </div>
      )}

      {/* chrome */}
      <div className="absolute left-4 right-28 top-4 sm:left-6 sm:right-auto sm:top-6 sm:max-w-[45%]">
        <div className="flex items-center gap-2">
          <span className="relative flex size-3">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand opacity-75" />
            <span className="relative inline-flex size-3 rounded-full bg-brand" />
          </span>
          <span className="text-sm font-bold uppercase tracking-widest text-white/80">Live</span>
        </div>
        <div className="mt-1 line-clamp-2 font-script text-2xl font-bold leading-tight drop-shadow sm:text-4xl">{name}</div>
        <div className="mt-1 flex gap-4 text-sm text-white/85 tabular-nums sm:text-lg">
          <span>📸 {photos.toLocaleString("en-MY")}</span>
          <span>👥 {guests}</span>
        </div>
      </div>

      <div className="absolute right-4 top-4 grid w-24 gap-3 sm:right-6 sm:top-6 sm:w-52">
        <div className="grid justify-items-center gap-1 rounded-2xl bg-white p-2 text-center text-ink shadow-2xl sm:gap-2 sm:rounded-3xl sm:p-3">
          <div className="w-full [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: qrSvg }} />
          <div className="text-[10px] font-bold leading-tight sm:text-sm">Scan & share your photos</div>
        </div>
        {voting && stats.topSnappers.length ? (
          <div className="hidden rounded-3xl bg-black/55 p-4 backdrop-blur sm:block">
            <div className="mb-2 text-sm font-bold">🏆 Top snappers</div>
            <ol className="grid gap-1.5 text-sm">
              {stats.topSnappers.slice(0, 3).map((s, i) => (
                <li key={s.id} className="flex items-center gap-2">
                  <span>{["🥇", "🥈", "🥉"][i]}</span>
                  <span className="min-w-0 flex-1 truncate">{s.name ?? "Guest"}</span>
                  <span className="text-white/70 tabular-nums">{s.count}</span>
                </li>
              ))}
            </ol>
          </div>
        ) : null}
      </div>

      {ticker ? (
        <div className="absolute inset-x-0 bottom-0 overflow-hidden bg-black/65 py-2 text-sm backdrop-blur sm:py-3 sm:text-lg">
          <div className="flex w-max whitespace-nowrap [animation:pc-ticker_60s_linear_infinite]">
            <span className="px-8">{ticker}</span>
            <span className="px-8" aria-hidden>
              {ticker}
            </span>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})}
        className="absolute bottom-14 right-4 grid size-10 place-items-center rounded-full bg-white/15 sm:bottom-16 sm:right-6 sm:size-11"
        aria-label="Full screen"
      >
        <Maximize className="size-5" aria-hidden />
      </button>
    </div>
  );
}

function Caption({ photo, mission, voting }: { photo: GalleryPhoto; mission: { title: string; emoji: string | null } | null | undefined; voting: boolean }) {
  return (
    <div className="absolute bottom-14 left-4 right-16 flex flex-wrap items-center gap-2 [animation:pc-rise_0.8s_ease_0.4s_both] sm:bottom-20 sm:left-6 sm:right-auto">
      {photo.by ? <div className="rounded-full bg-black/55 px-3 py-1.5 text-sm font-semibold backdrop-blur sm:px-4 sm:py-2 sm:text-lg">Photo by {photo.by}</div> : null}
      {mission ? (
        <div className="rounded-full bg-black/55 px-3 py-1.5 text-sm font-semibold backdrop-blur sm:px-4 sm:py-2 sm:text-lg">
          {mission.emoji ?? "🎯"} {mission.title}
        </div>
      ) : null}
      {voting && photo.votes ? <div className="rounded-full bg-black/55 px-3 py-1.5 text-sm font-semibold backdrop-blur sm:px-4 sm:py-2 sm:text-lg">❤️ {photo.votes}</div> : null}
    </div>
  );
}
