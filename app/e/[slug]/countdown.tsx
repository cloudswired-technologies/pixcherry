"use client";

import { useEffect, useState } from "react";
import { CalendarClock, MapPin } from "lucide-react";
import { Logo } from "@/components/brand";

// What guests see before the event starts: the album exists (it's paid and ready),
// and opens at the start time. At zero the page reloads into the live album.

function parts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

export function Countdown({ name, startsAt, when, venue, cover, accent }: { name: string; startsAt: string; when: string; venue: string; cover: string | null; accent: string }) {
  const target = new Date(startsAt).getTime();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => {
      const t = Date.now();
      setNow(t);
      if (t >= target) location.reload();
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);
  const left = parts(now === null ? target - Date.parse(startsAt) : target - now);
  const units = [
    { v: left.d, l: left.d === 1 ? "day" : "days" },
    { v: left.h, l: "hours" },
    { v: left.m, l: "minutes" },
    { v: left.s, l: "seconds" },
  ];
  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-5 flex justify-center">
          <Logo className="text-lg" />
        </div>
        <div className="overflow-hidden rounded-3xl bg-white shadow-lift">
          {cover ? <img src={cover} alt="" className="aspect-[16/9] w-full object-cover" /> : null}
          <div className="p-6 text-center">
            <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">{name}</h1>
            <p className="mt-2 flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
              <CalendarClock className="size-4" aria-hidden /> {when}
            </p>
            {venue ? (
              <p className="mt-1 flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="size-4" aria-hidden /> {venue}
              </p>
            ) : null}
            <p className="mt-6 text-sm font-semibold" style={{ color: accent }}>
              The photo album opens in
            </p>
            <div className="mt-3 grid grid-cols-4 gap-2" role="timer" aria-live="off" aria-label="Time until the album opens">
              {units.map((u) => (
                <div key={u.l} className="rounded-2xl bg-canvas px-1 py-3">
                  <div className="text-3xl font-extrabold tabular-nums text-ink">{now === null ? "–" : String(u.v).padStart(2, "0")}</div>
                  <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{u.l}</div>
                </div>
              ))}
            </div>
            <p className="mt-6 text-sm text-muted-foreground">Keep this page — scan the same QR code when the event starts to snap and share your photos.</p>
          </div>
        </div>
      </div>
    </main>
  );
}
