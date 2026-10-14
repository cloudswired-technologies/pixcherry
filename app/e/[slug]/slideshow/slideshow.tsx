"use client";

import { useEffect, useRef, useState } from "react";
import { Maximize } from "lucide-react";
import type { GalleryPhoto } from "@/lib/photos";

// Full-screen slideshow for a projector/TV. New photos jump the queue so guests
// see their upload on the big screen within seconds.

const SHOW_MS = 6000;
const POLL_MS = 10_000;

export function Slideshow({ slug, name, qrSvg }: { slug: string; name: string; qrSvg: string }) {
  const [current, setCurrent] = useState<GalleryPhoto | null>(null);
  const [count, setCount] = useState(0);
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
      const b = (await r.json()) as { photos: GalleryPhoto[]; count: number };
      setCount(b.count);
      const ready = b.photos.filter((p) => p.status === "ready");
      if (!ready.length) return;
      latest.current = ready[0].at;
      if (since) fresh.current.push(...ready.reverse());
      else pool.current = ready;
    };
    const advance = () => {
      const nextPhoto = fresh.current.shift();
      if (nextPhoto) {
        pool.current = [nextPhoto, ...pool.current.filter((p) => p.id !== nextPhoto.id)].slice(0, 500);
        pos.current = 0;
        setCurrent(nextPhoto);
      } else if (pool.current.length) {
        pos.current = (pos.current + 1) % pool.current.length;
        setCurrent(pool.current[pos.current]);
      }
    };
    fetchPhotos(null).then(() => !stop && advance());
    const show = setInterval(advance, SHOW_MS);
    const poll = setInterval(() => fetchPhotos(latest.current), POLL_MS);
    return () => {
      stop = true;
      clearInterval(show);
      clearInterval(poll);
    };
  }, [slug]);

  return (
    <div className="fixed inset-0 overflow-hidden bg-black text-white">
      {current ? (
        <>
          <img key={`bg-${current.id}`} src={current.sm} alt="" className="absolute inset-0 size-full scale-110 object-cover opacity-40 blur-2xl" />
          <img key={current.id} src={current.md} alt="" className="absolute inset-0 m-auto max-h-full max-w-full animate-[fade_0.8s_ease] object-contain" />
          {current.by ? <div className="absolute bottom-6 left-6 rounded-full bg-black/50 px-4 py-2 text-lg font-semibold">Photo by {current.by}</div> : null}
        </>
      ) : (
        <div className="grid size-full place-items-center text-2xl text-white/70">Waiting for the first photo…</div>
      )}
      <div className="absolute right-6 top-6 grid w-44 justify-items-center gap-2 rounded-2xl bg-white p-3 text-center text-ink">
        <div className="w-full [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: qrSvg }} />
        <div className="text-sm font-bold leading-tight">Scan to add your photos</div>
      </div>
      <div className="absolute left-6 top-6 max-w-[50%]">
        <div className="text-2xl font-bold drop-shadow">{name}</div>
        <div className="text-white/70">{count.toLocaleString("en-MY")} photos</div>
      </div>
      <button
        type="button"
        onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})}
        className="absolute bottom-6 right-6 grid size-11 place-items-center rounded-full bg-white/15"
        aria-label="Full screen"
      >
        <Maximize className="size-5" aria-hidden />
      </button>
      <style>{`@keyframes fade{from{opacity:0}to{opacity:1}}`}</style>
    </div>
  );
}
