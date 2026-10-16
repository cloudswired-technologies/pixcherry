"use client";

import { useEffect, useState } from "react";
import { ArrowRight, X } from "lucide-react";

// First visit to an album: three quick cards on what to do here, ending on
// "Join the album". Shown once per album per browser.

type Card = { emoji: string; title: string; text: string };

export function Welcome({ slug, eventName, missions, onJoin, joined }: { slug: string; eventName: string; missions: boolean; onJoin: () => void; joined: boolean }) {
  const key = `pc-welcome-${slug}`;
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        if (!joined && !localStorage.getItem(key) && !localStorage.getItem("pc-skip-intro")) setOpen(true);
      } catch {
        /* storage blocked: skip the intro */
      }
    }, 300);
    return () => clearTimeout(t);
  }, [key, joined]);
  const close = () => {
    try {
      localStorage.setItem(key, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  };
  if (!open) return null;
  const cards: Card[] = [
    { emoji: "📸", title: "Snap the day", text: "Tap the big red Snap button to take photos with film looks — or upload from your gallery. Everyone sees them live." },
    missions
      ? { emoji: "🎯", title: "Missions & hashtags", text: "Take on fun photo missions and tag your shots (#reception, #family…) — each tag becomes an album." }
      : { emoji: "#️⃣", title: "Tag your photos", text: "Add a hashtag or a caption when you share — each hashtag becomes an album everyone can browse." },
    { emoji: "❤️", title: "Heart, wish, keep", text: "Heart your favourites, leave a wish for the hosts, and keep the whole album after the event." },
  ];
  const last = i === cards.length - 1;
  const c = cards[i];
  return (
    <div className="fixed inset-0 z-[75] grid place-items-end bg-ink/60 p-3 backdrop-blur-sm sm:place-items-center" role="dialog" aria-modal="true" aria-label="Welcome">
      <div className="w-full max-w-sm overflow-hidden rounded-[2rem] bg-card shadow-lift [animation:pc-rise_0.3s_ease]">
        <div className="relative bg-gradient-to-br from-brand to-[#ff8a5c] px-6 pb-8 pt-6 text-center text-white">
          <button type="button" onClick={close} className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-white/20" aria-label="Skip intro">
            <X className="size-4" aria-hidden />
          </button>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/80">Welcome to</p>
          <p className="mt-1 truncate text-lg font-extrabold">{eventName}</p>
          <div key={i} className="mt-5 text-6xl [animation:pc-pop_0.5s_ease]">
            {c.emoji}
          </div>
        </div>
        <div className="grid gap-4 p-6 text-center">
          <div>
            <h2 className="text-xl font-extrabold">{c.title}</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">{c.text}</p>
          </div>
          <div className="flex justify-center gap-1.5" aria-hidden>
            {cards.map((_, n) => (
              <span key={n} className={`h-1.5 rounded-full transition-all ${n === i ? "w-6 bg-brand" : "w-1.5 bg-ink/20"}`} />
            ))}
          </div>
          {last ? (
            <button
              type="button"
              onClick={() => {
                close();
                onJoin();
              }}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-brand font-bold text-white shadow-cherry"
            >
              Join the album 🎉
            </button>
          ) : (
            <button type="button" onClick={() => setI(i + 1)} className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-ink font-bold text-white">
              Next <ArrowRight className="size-4" aria-hidden />
            </button>
          )}
          <button type="button" onClick={close} className="text-sm font-semibold text-muted-foreground">
            {last ? "Just look around" : "Skip"}
          </button>
        </div>
      </div>
    </div>
  );
}
