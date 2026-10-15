"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Camera, Check, Heart } from "lucide-react";
import { initial, type MissionInfo, type Snapper, type TopPhoto } from "./panels";

// Missions tab (every mission in full, who finished it fastest, mission masters)
// and the Top Snappers tab (podium + most loved photos).

type Finisher = { id: string; name: string | null; at: string };
type Board = { missions: { id: string; people: Finisher[]; total: number }[]; finishers: Finisher[] };

const MEDALS = ["🥇", "🥈", "🥉"];
const time = (iso: string) => new Date(iso).toLocaleTimeString("en-MY", { hour: "numeric", minute: "2-digit" });

/** Mission board for the event; refetches when `refreshKey` changes and every 30 s. */
export function useMissionBoard(slug: string, enabled: boolean, refreshKey: number) {
  const [board, setBoard] = useState<Board | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    const load = () =>
      fetch(`/api/e/${slug}/missions`)
        .then((r) => (r.ok ? r.json() : null))
        .then((b: Board | null) => live && b && setBoard(b))
        .catch(() => {});
    const first = setTimeout(load, 0);
    const t = setInterval(() => !document.hidden && load(), 30_000);
    return () => {
      live = false;
      clearTimeout(first);
      clearInterval(t);
    };
  }, [slug, enabled, refreshKey]);
  return board;
}

function Dot({ name, me }: { name: string | null; me?: boolean }) {
  return <span className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold text-white ${me ? "bg-ink" : "bg-brand"}`}>{initial(name)}</span>;
}

export function MissionsPanel({
  missions,
  done,
  board,
  me,
  canShoot,
  onSnap,
  onOpen,
}: {
  missions: MissionInfo[];
  done: Set<string>;
  board: Board | null;
  me: string | null;
  canShoot: boolean;
  onSnap: (id: string) => void;
  onOpen: (m: MissionInfo) => void;
}) {
  const n = missions.filter((m) => done.has(m.id)).length;
  const all = missions.length > 0 && n === missions.length;
  const rank = me && board ? board.finishers.findIndex((f) => f.id === me) : -1;
  const per = new Map(board?.missions.map((m) => [m.id, m]) ?? []);
  return (
    <div className="grid gap-4 px-2">
      {all ? (
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#ffb703] via-[#fb8500] to-brand p-5 text-white shadow-lift [animation:pc-pop_0.6s_ease]">
          <div className="text-5xl">🏆</div>
          <h2 className="mt-2 text-2xl font-extrabold">Mission Master!</h2>
          <p className="mt-1 text-white/90">
            You completed all {missions.length} missions{rank >= 0 ? ` — #${rank + 1} to finish` : ""}. Legend.
          </p>
        </section>
      ) : (
        <section className="rounded-3xl bg-white p-4 shadow-soft">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xl font-extrabold">🎯 Snap missions</h2>
            <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-sm font-bold text-brand">
              {n}/{missions.length}
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-brand transition-[width] duration-700" style={{ width: `${(n / Math.max(1, missions.length)) * 100}%` }} />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">Complete every mission to earn the 🏆 Mission Master badge. The fastest finishers make the board!</p>
        </section>
      )}

      {missions.map((m) => {
        const ok = done.has(m.id);
        const b = per.get(m.id);
        return (
          <article key={m.id} className={`rounded-3xl p-4 shadow-soft ${ok ? "bg-ok-soft" : "bg-white"}`}>
            <div className="flex items-start gap-3">
              <span className="text-3xl leading-none">{m.emoji ?? "🎯"}</span>
              <div className="min-w-0 flex-1">
                <h3 className="font-bold leading-snug">{m.title}</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {m.count} photo{m.count === 1 ? "" : "s"}
                  {b ? ` · ${b.total} guest${b.total === 1 ? "" : "s"} completed` : ""}
                </p>
              </div>
              {ok ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-ok px-2.5 py-1 text-xs font-bold text-white">
                  <Check className="size-3.5" aria-hidden /> Done
                </span>
              ) : canShoot ? (
                <button type="button" onClick={() => onSnap(m.id)} className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand px-3 py-1.5 text-xs font-bold text-white shadow-cherry">
                  <Camera className="size-3.5" aria-hidden /> Snap it
                </button>
              ) : null}
            </div>
            {b?.people.length ? (
              <div className="mt-3">
                <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">⚡ Fastest</div>
                <ol className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
                  {b.people.slice(0, 5).map((p, i) => (
                    <li key={p.id} className={`flex shrink-0 items-center gap-1.5 rounded-full py-1 pl-1 pr-3 text-xs font-semibold ${p.id === me ? "bg-ink text-white" : "bg-background"}`}>
                      <span className="w-5 text-center">{MEDALS[i] ?? i + 1}</span>
                      {p.id === me ? "You" : (p.name ?? "Guest")}
                    </li>
                  ))}
                  {b.total > 5 ? <li className="shrink-0 self-center px-1 text-xs text-muted-foreground">+{b.total - 5} more</li> : null}
                </ol>
              </div>
            ) : null}
            {m.count ? (
              <button type="button" onClick={() => onOpen(m)} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand">
                See the photos <ArrowRight className="size-4" aria-hidden />
              </button>
            ) : null}
          </article>
        );
      })}

      {board?.finishers.length ? (
        <section className="rounded-3xl bg-white p-4 shadow-soft">
          <h3 className="font-bold">🏆 Mission masters</h3>
          <p className="text-xs text-muted-foreground">Everyone who completed all missions, fastest first.</p>
          <ol className="mt-3 grid gap-2">
            {board.finishers.map((f, i) => (
              <li key={f.id} className={`flex items-center gap-3 rounded-2xl px-3 py-2 ${f.id === me ? "bg-ink text-white" : "bg-background"}`}>
                <span className="w-7 text-center text-xl">{MEDALS[i] ?? <span className="text-sm font-bold opacity-60">{i + 1}</span>}</span>
                <span className="min-w-0 flex-1 truncate font-semibold">{f.id === me ? "You" : (f.name ?? "Guest")}</span>
                <span className="text-xs opacity-70">finished {time(f.at)}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}

export function TopPanel({
  snappers,
  topPhotos,
  me,
  voting,
  onPerson,
  onTop,
}: {
  snappers: Snapper[];
  topPhotos: TopPhoto[];
  me: string | null;
  voting: boolean;
  onPerson: (s: Snapper) => void;
  onTop: () => void;
}) {
  if (!snappers.length) return <p className="mx-2 rounded-3xl bg-white px-4 py-14 text-center text-sm text-muted-foreground shadow-soft">No one has shared yet — snap one and take the lead! 📸</p>;
  const podium = [snappers[1], snappers[0], snappers[2]];
  return (
    <div className="grid gap-4 px-2">
      <section className="rounded-3xl bg-white p-4 pt-6 shadow-soft">
        <h2 className="text-center text-xl font-extrabold">🏆 Top Snappers</h2>
        <div className="mt-5 grid grid-cols-3 items-end gap-2">
          {podium.map((s, i) => {
            if (!s) return <div key={i} />;
            const place = i === 1 ? 0 : i === 0 ? 1 : 2;
            return (
              <button key={s.id} type="button" onClick={() => onPerson(s)} className="grid justify-items-center gap-1.5 text-center">
                <span className="text-2xl">{MEDALS[place]}</span>
                <span className={`grid place-items-center rounded-full font-bold text-white shadow-soft ${place === 0 ? "size-16 bg-brand text-2xl" : "size-12 bg-ink/80 text-lg"}`}>{initial(s.name)}</span>
                <span className="w-full truncate text-sm font-semibold">{s.id === me ? "You" : (s.name ?? "Guest")}</span>
                <span className={`grid w-full place-items-center rounded-t-2xl font-extrabold ${place === 0 ? "h-20 bg-brand-soft text-brand" : place === 1 ? "h-14 bg-muted" : "h-10 bg-muted"}`}>{s.count} 📸</span>
              </button>
            );
          })}
        </div>
        {snappers.length > 3 ? (
          <ol className="mt-4 grid gap-2">
            {snappers.slice(3).map((s, i) => (
              <li key={s.id}>
                <button type="button" onClick={() => onPerson(s)} className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left ${s.id === me ? "bg-ink text-white" : "bg-background"}`}>
                  <span className="w-6 text-center text-sm font-bold opacity-60">{i + 4}</span>
                  <Dot name={s.name} me={s.id === me} />
                  <span className="min-w-0 flex-1 truncate font-semibold">{s.id === me ? "You" : (s.name ?? "Guest")}</span>
                  <span className="text-sm opacity-70">{s.count} 📸</span>
                </button>
              </li>
            ))}
          </ol>
        ) : null}
      </section>

      {voting && topPhotos.length ? (
        <section className="rounded-3xl bg-white p-4 shadow-soft">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-bold">❤️ Most loved photos</h3>
            <button type="button" onClick={onTop} className="text-sm font-semibold text-brand">
              See all
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {topPhotos.slice(0, 3).map((p, i) => (
              <button key={p.id} type="button" onClick={onTop} className="relative aspect-square overflow-hidden rounded-2xl bg-muted">
                <img src={p.sm} alt={p.by ? `Photo by ${p.by}` : "Event photo"} loading="lazy" className="size-full object-cover" />
                <span className="absolute left-1.5 top-1.5 text-lg">{MEDALS[i]}</span>
                <span className="absolute bottom-1.5 right-1.5 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-semibold text-white">
                  <Heart className="size-3 fill-white" aria-hidden /> {p.votes}
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
