"use client";

import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";
import { cn } from "@/components/ui";

export type Chapter = { at: number; title: string };

/** The guest walkthrough video in a phone frame, with chapters you can jump to. */
export function ExplainerVideo({ src, poster, chapters }: { src: { mp4: string; webm: string }; poster: string; chapters: Chapter[] }) {
  const video = useRef<HTMLVideoElement>(null);
  const [now, setNow] = useState(0);
  const [started, setStarted] = useState(false);
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    const t = () => setNow(v.currentTime);
    v.addEventListener("timeupdate", t);
    return () => v.removeEventListener("timeupdate", t);
  }, []);
  const active = chapters.reduce((a, c, i) => (now >= c.at ? i : a), 0);
  const jump = (at: number) => {
    const v = video.current;
    if (!v) return;
    v.currentTime = at;
    void v.play();
    setStarted(true);
  };

  return (
    <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:gap-16">
      <div className="relative mx-auto w-full max-w-[19rem]">
        <div className="rounded-[2.4rem] bg-ink p-2 shadow-lift">
          <video
            ref={video}
            className="block aspect-[390/844] w-full rounded-[2rem] bg-black object-cover"
            poster={poster}
            preload="none"
            playsInline
            controls={started}
            onPlay={() => setStarted(true)}
          >
            <source src={src.mp4} type="video/mp4" />
            <source src={src.webm} type="video/webm" />
          </video>
        </div>
        {!started ? (
          <button
            type="button"
            onClick={() => jump(0)}
            className="absolute inset-0 m-auto grid size-20 place-items-center rounded-full bg-brand text-white shadow-cherry transition-transform hover:scale-105"
            aria-label="Play the video"
          >
            <Play className="ml-1 size-8 fill-white" aria-hidden />
          </button>
        ) : null}
      </div>
      <ol className="grid gap-1">
        {chapters.map((c, i) => (
          <li key={c.title}>
            <button
              type="button"
              onClick={() => jump(c.at)}
              className={cn(
                "flex w-full items-baseline gap-4 rounded-2xl px-4 py-3 text-left transition-colors",
                started && i === active ? "bg-white shadow-soft" : "hover:bg-white/70",
              )}
            >
              <span className="w-10 shrink-0 font-mono text-sm tabular-nums text-muted-foreground">
                {Math.floor(c.at / 60)}:{String(Math.floor(c.at % 60)).padStart(2, "0")}
              </span>
              <span className={cn("font-semibold", started && i === active ? "text-brand" : "text-ink")}>{c.title}</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
