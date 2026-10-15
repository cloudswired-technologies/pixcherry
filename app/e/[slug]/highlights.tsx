"use client";

import { useRef, useState } from "react";
import { Heart, Plus } from "lucide-react";
import { initial, type PersonItem } from "./panels";

// Highlights building blocks: Instagram-style story rings for the people who
// shared, and a swipeable "Best moments" carousel.

export function Stories({ people, me, onOpen, onAdd }: { people: PersonItem[]; me: string | null; onOpen: (p: PersonItem) => void; onAdd: (() => void) | null }) {
  if (!people.length && !onAdd) return null;
  // Your own story first, like Instagram.
  const list = [...people].sort((a, b) => Number(b.id === me) - Number(a.id === me));
  return (
    <section aria-label="People" className="no-scrollbar -mx-2 flex gap-3 overflow-x-auto px-3 pb-1 pt-1">
      {onAdd ? (
        <button type="button" onClick={onAdd} className="grid w-[4.5rem] shrink-0 justify-items-center gap-1.5 text-center">
          <span className="grid size-[4.25rem] place-items-center rounded-full border-2 border-dashed border-brand/50 bg-white text-brand">
            <Plus className="size-7" aria-hidden />
          </span>
          <span className="w-full truncate text-xs font-semibold">Add yours</span>
        </button>
      ) : null}
      {list.slice(0, 30).map((p) => (
        <button key={p.id} type="button" onClick={() => onOpen(p)} className="grid w-[4.5rem] shrink-0 justify-items-center gap-1.5 text-center">
          <span className="rounded-full bg-gradient-to-tr from-[#ffb703] via-brand to-[#c026d3] p-[3px]">
            <span className="block rounded-full bg-paper p-[2px]">
              {p.cover ? (
                <img src={p.cover} alt="" className="size-[3.75rem] rounded-full object-cover" />
              ) : (
                <span className="grid size-[3.75rem] place-items-center rounded-full bg-brand text-lg font-bold text-white">{initial(p.name)}</span>
              )}
            </span>
          </span>
          <span className="w-full truncate text-xs font-semibold">{p.id === me ? "You" : (p.name ?? "Guest")}</span>
        </button>
      ))}
    </section>
  );
}

export type Moment = { id: string; src: string; by: string | null; votes: number };

export function BestMoments({ title, moments, onOpen, onAll }: { title: string; moments: Moment[]; onOpen: (id: string) => void; onAll: () => void }) {
  const track = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState(0);
  if (!moments.length) return null;
  return (
    <section aria-label={title}>
      <div className="mb-2.5 flex items-center justify-between px-1">
        <h3 className="text-lg font-extrabold">{title}</h3>
        <button type="button" onClick={onAll} className="text-sm font-semibold text-brand">
          See all
        </button>
      </div>
      <div
        ref={track}
        onScroll={(e) => {
          const el = e.currentTarget;
          const w = el.firstElementChild?.clientWidth ?? 1;
          setAt(Math.round(el.scrollLeft / (w + 12)));
        }}
        className="no-scrollbar -mx-2 flex snap-x snap-mandatory scroll-px-2 gap-3 overflow-x-auto scroll-smooth px-2 pb-1"
      >
        {moments.map((m, i) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onOpen(m.id)}
            className="relative aspect-[3/4] w-[62%] max-w-xs shrink-0 snap-start overflow-hidden rounded-[1.75rem] bg-ink text-left shadow-lift sm:w-[40%]"
          >
            <img src={m.src} alt={m.by ? `Photo by ${m.by}` : "Event photo"} loading={i < 2 ? "eager" : "lazy"} className="absolute inset-0 size-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/10" />
            {i === 0 ? <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-bold text-ink shadow-soft">👑 Top</span> : null}
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-4 text-white">
              <span className="min-w-0 truncate text-sm font-semibold">by {m.by ?? "a guest"}</span>
              {m.votes ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-sm font-bold backdrop-blur">
                  <Heart className="size-4 fill-white" aria-hidden /> {m.votes}
                </span>
              ) : null}
            </div>
          </button>
        ))}
      </div>
      {moments.length > 1 ? (
        <div className="mt-2 flex justify-center gap-1.5" aria-hidden>
          {moments.map((m, i) => (
            <span key={m.id} className={`h-1.5 rounded-full transition-all ${i === at ? "w-5 bg-brand" : "w-1.5 bg-ink/20"}`} />
          ))}
        </div>
      ) : null}
    </section>
  );
}
