"use client";

import { useEffect, useRef, useState } from "react";
import { Maximize } from "lucide-react";
import type { GalleryPhoto } from "@/lib/photos";

// Big-screen slideshow. New photos jump the queue with a "just shared" pop-up;
// wishes scroll along the bottom; the leaderboard sits on the side.

const SHOW_MS = 6000;
const POLL_MS = 8000;
const STATS_MS = 20_000;

type Stats = { photos: number; guests: number; topSnappers: { id: string; name: string | null; count: number }[]; missions: { id: string; title: string; emoji: string | null }[] };
type Wish = { id: string; name: string | null; message: string };

export function Slideshow({ slug, name, qrSvg, voting, wishes: wishesOn }: { slug: string; name: string; qrSvg: string; voting: boolean; wishes: boolean }) {
  const [current, setCurrent] = useState<{ photo: GalleryPhoto; fresh: boolean } | null>(null);
  const [stats, setStats] = useState<Stats>({ photos: 0, guests: 0, topSnappers: [], missions: [] });
  const [wishes, setWishes] = useState<Wish[]>([]);
  const pool = useRef<GalleryPhoto[]>([]);
  const fresh = useRef<GalleryPhoto[]>([]);
  const pos = useRef(0);
  const latest = useRef<string | null>(null);

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
    const advance = () => {
      const n = fresh.current.shift();
      if (n) {
        pool.current = [n, ...pool.current.filter((p) => p.id !== n.id)].slice(0, 500);
        pos.current = 0;
        setCurrent({ photo: n, fresh: true });
      } else if (pool.current.length) {
        pos.current = (pos.current + 1) % pool.current.length;
        setCurrent({ photo: pool.current[pos.current], fresh: false });
      }
    };
    const loadStats = async () => {
      const r = await fetch(`/api/e/${slug}/stats`).catch(() => null);
      if (r?.ok) setStats((await r.json()) as Stats);
    };
    const loadWishes = async () => {
      if (!wishesOn) return;
      const r = await fetch(`/api/e/${slug}/wishes`).catch(() => null);
      if (r?.ok) setWishes(((await r.json()) as { wishes: Wish[] }).wishes.slice(0, 30));
    };
    fetchPhotos(null).then(() => !stop && advance());
    loadStats();
    loadWishes();
    const t1 = setInterval(advance, SHOW_MS);
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

  const ph = current?.photo;
  const mission = ph?.mission ? stats.missions.find((m) => m.id === ph.mission) : null;
  const ticker = wishes.map((w) => `💌 ${w.name ?? "A guest"}: ${w.message.replace(/\s+/g, " ")}`).join("     ·     ");

  return (
    <div className="fixed inset-0 overflow-hidden bg-black text-white">
      {ph ? (
        <>
          <img key={`bg-${ph.id}`} src={ph.sm} alt="" className="absolute inset-0 size-full scale-110 object-cover opacity-40 blur-2xl" />
          <img key={ph.id} src={ph.md} alt="" className="absolute inset-0 m-auto max-h-full max-w-full animate-[fade_0.8s_ease] object-contain" />
          {current?.fresh ? (
            <div key={`new-${ph.id}`} className="absolute left-1/2 top-8 -translate-x-1/2 rounded-full bg-white px-6 py-3 text-xl font-bold text-ink shadow-2xl [animation:pc-pop_5.5s_ease_forwards]">
              📸 {ph.by ? `${ph.by} just shared!` : "New photo!"}
            </div>
          ) : null}
          <div className="absolute bottom-20 left-6 flex flex-wrap items-center gap-2">
            {ph.by ? <div className="rounded-full bg-black/55 px-4 py-2 text-lg font-semibold">Photo by {ph.by}</div> : null}
            {mission ? (
              <div className="rounded-full bg-black/55 px-4 py-2 text-lg font-semibold">
                {mission.emoji ?? "🎯"} {mission.title}
              </div>
            ) : null}
            {voting && ph.votes ? <div className="rounded-full bg-black/55 px-4 py-2 text-lg font-semibold">❤️ {ph.votes}</div> : null}
          </div>
        </>
      ) : (
        <div className="grid size-full place-items-center text-2xl text-white/70">Waiting for the first photo… scan the code and start snapping! 📸</div>
      )}

      <div className="absolute left-6 top-6 max-w-[45%]">
        <div className="text-2xl font-bold drop-shadow">{name}</div>
        <div className="mt-1 flex gap-3 text-white/80">
          <span>📸 {stats.photos.toLocaleString("en-MY")}</span>
          <span>👥 {stats.guests}</span>
        </div>
      </div>

      <div className="absolute right-6 top-6 grid w-48 gap-3">
        <div className="grid justify-items-center gap-2 rounded-2xl bg-white p-3 text-center text-ink">
          <div className="w-full [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: qrSvg }} />
          <div className="text-sm font-bold leading-tight">Scan to add your photos</div>
        </div>
        {voting && stats.topSnappers.length ? (
          <div className="rounded-2xl bg-black/55 p-3 backdrop-blur">
            <div className="mb-2 text-sm font-bold">🏆 Top snappers</div>
            <ol className="grid gap-1.5 text-sm">
              {stats.topSnappers.slice(0, 3).map((s, i) => (
                <li key={s.id} className="flex items-center gap-2">
                  <span>{["🥇", "🥈", "🥉"][i]}</span>
                  <span className="min-w-0 flex-1 truncate">{s.name ?? "Guest"}</span>
                  <span className="text-white/70">{s.count}</span>
                </li>
              ))}
            </ol>
          </div>
        ) : null}
      </div>

      {ticker ? (
        <div className="absolute inset-x-0 bottom-0 overflow-hidden bg-black/60 py-3 text-lg backdrop-blur">
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
      <style>{`@keyframes fade{from{opacity:0}to{opacity:1}}`}</style>
    </div>
  );
}
