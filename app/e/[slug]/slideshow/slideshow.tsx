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
            className="absolute inset-0 m-auto max-h-full max-w-full object-contain"
            style={{ animation: `${KB[scene.fx % KB.length]} ${SHOW_MS + 1000}ms linear both` }}
          />
          <Caption photo={scene.photo} mission={mission(scene.photo)} voting={voting} />
        </div>
      ) : scene.kind === "fresh" ? (
        <div key={scene.key} className="absolute inset-0 grid place-items-center">
          <img src={scene.photo.sm} alt="" className="absolute inset-0 size-full scale-110 object-cover opacity-30 blur-2xl" />
          <div className="relative bg-[#fbf8f1] p-5 pb-20 shadow-2xl [animation:pc-drop_1.1s_cubic-bezier(.2,1.4,.4,1)_both]" style={{ rotate: "-3deg" }}>
            <img src={scene.photo.md} alt="" className="max-h-[62vh] max-w-[70vw] object-contain" />
            <div className="absolute inset-x-0 bottom-4 text-center font-script text-4xl font-bold text-ink">{scene.photo.by ? `by ${scene.photo.by}` : "just shared!"}</div>
          </div>
          <div className="absolute left-1/2 top-8 -translate-x-1/2 rounded-full bg-brand px-7 py-3 text-2xl font-bold shadow-cherry [animation:pc-pop_6s_ease_forwards]">
            📸 {scene.photo.by ? `${scene.photo.by} just shared!` : "New photo!"}
          </div>
        </div>
      ) : scene.kind === "collage" ? (
        <div key={scene.key} className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-3 p-6 pt-28">
          {scene.photos.map((p, i) => (
            <div key={p.id} className="relative overflow-hidden rounded-3xl bg-black" style={{ animation: `pc-ss-zoom 0.8s ease ${i * 0.18}s both` }}>
              <img src={p.md} alt="" className="size-full object-cover" style={{ animation: `${KB[i % KB.length]} ${SHOW_MS + 1000}ms linear both` }} />
              {p.by ? <span className="absolute bottom-3 left-3 rounded-full bg-black/55 px-3 py-1 text-base font-semibold">{p.by}</span> : null}
            </div>
          ))}
        </div>
      ) : (
        <div key={scene.key} className="absolute inset-0 grid place-items-center px-16">
          {scene.bg ? <img src={scene.bg.sm} alt="" className="absolute inset-0 size-full scale-110 object-cover opacity-25 blur-2xl" /> : null}
          <div className="relative max-w-4xl rounded-[2.5rem] bg-white/95 px-14 py-12 text-center text-ink shadow-2xl [animation:pc-ss-zoom_0.9s_ease_both]">
            <div className="text-5xl">💌</div>
            <p className="mt-4 font-script text-5xl leading-tight">“{scene.wish.message}”</p>
            <p className="mt-6 text-2xl font-bold text-brand">— {scene.wish.name ?? "A guest"}</p>
          </div>
        </div>
      )}

      {/* chrome */}
      <div className="absolute left-6 top-6 max-w-[45%]">
        <div className="flex items-center gap-2">
          <span className="relative flex size-3">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand opacity-75" />
            <span className="relative inline-flex size-3 rounded-full bg-brand" />
          </span>
          <span className="text-sm font-bold uppercase tracking-widest text-white/80">Live</span>
        </div>
        <div className="mt-1 font-script text-4xl font-bold drop-shadow">{name}</div>
        <div className="mt-1 flex gap-4 text-lg text-white/85 tabular-nums">
          <span>📸 {photos.toLocaleString("en-MY")}</span>
          <span>👥 {guests}</span>
        </div>
      </div>

      <div className="absolute right-6 top-6 grid w-52 gap-3">
        <div className="grid justify-items-center gap-2 rounded-3xl bg-white p-3 text-center text-ink shadow-2xl">
          <div className="w-full [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: qrSvg }} />
          <div className="text-sm font-bold leading-tight">Scan & share your photos</div>
        </div>
        {voting && stats.topSnappers.length ? (
          <div className="rounded-3xl bg-black/55 p-4 backdrop-blur">
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
        <div className="absolute inset-x-0 bottom-0 overflow-hidden bg-black/65 py-3 text-lg backdrop-blur">
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
        className="absolute bottom-16 right-6 grid size-11 place-items-center rounded-full bg-white/15"
        aria-label="Full screen"
      >
        <Maximize className="size-5" aria-hidden />
      </button>
    </div>
  );
}

function Caption({ photo, mission, voting }: { photo: GalleryPhoto; mission: { title: string; emoji: string | null } | null | undefined; voting: boolean }) {
  return (
    <div className="absolute bottom-20 left-6 flex flex-wrap items-center gap-2 [animation:pc-rise_0.8s_ease_0.4s_both]">
      {photo.by ? <div className="rounded-full bg-black/55 px-4 py-2 text-lg font-semibold backdrop-blur">Photo by {photo.by}</div> : null}
      {mission ? (
        <div className="rounded-full bg-black/55 px-4 py-2 text-lg font-semibold backdrop-blur">
          {mission.emoji ?? "🎯"} {mission.title}
        </div>
      ) : null}
      {voting && photo.votes ? <div className="rounded-full bg-black/55 px-4 py-2 text-lg font-semibold backdrop-blur">❤️ {photo.votes}</div> : null}
    </div>
  );
}
