import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowDown, ArrowUp, Sparkles, Trash2 } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { Confirm } from "@/components/confirm";
import { Card, Field, Input, Notice, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { listMissions, missionBoard } from "@/lib/engage";
import { getManagedEvent } from "@/lib/events";
import { addMission, addPresetMissions, deleteMission, moveMission } from "../../actions";

export const metadata = { title: "Missions" };

const MEDALS = ["🥇", "🥈", "🥉"];
const time = (d: string) => new Date(d).toLocaleTimeString("en-MY", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kuala_Lumpur" });

export default async function Missions({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const e = await getManagedEvent(id, user);
  if (!e || !e.paid_at) notFound();
  const base = `/dashboard/events/${e.id}`;
  if (!e.cfg.features.missions) {
    return (
      <div className="grid gap-5">
        <PageHeader title="Missions" sub="Photo challenges for your guests." />
        <Notice>
          Snap missions are on a higher package.{" "}
          <Link href={`${base}/checkout`} className="font-semibold underline">
            Upgrade
          </Link>
        </Notice>
      </div>
    );
  }
  const [missions, board] = await Promise.all([listMissions(e.id), missionBoard(e.id)]);
  const per = new Map(board.missions.map((m) => [m.id, m]));

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Missions"
        sub="Make it a game: guests tick off photo challenges and race to become Mission Master."
        actions={
          <form action={addPresetMissions.bind(null, e.id)}>
            <button className="inline-flex h-10 items-center gap-1.5 rounded-full bg-brand-soft px-4 text-sm font-semibold text-brand-strong">
              <Sparkles className="size-4" aria-hidden /> Add the wedding pack
            </button>
          </form>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card className="grid content-start gap-4">
          <h2 className="text-lg font-bold">Your missions</h2>
          {missions.length ? (
            <ol className="grid gap-2">
              {missions.map((m, i) => {
                const b = per.get(m.id);
                return (
                  <li key={m.id} className="rounded-xl border border-border bg-background p-3">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{m.emoji ?? "🎯"}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold leading-snug">{m.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {m.count} photo{m.count === 1 ? "" : "s"} · {b?.total ?? 0} guest{b?.total === 1 ? "" : "s"} completed
                        </span>
                      </span>
                      <form action={moveMission.bind(null, e.id, m.id, -1)}>
                        <button disabled={i === 0} className="grid size-8 place-items-center rounded-full hover:bg-muted disabled:opacity-30" aria-label="Move up">
                          <ArrowUp className="size-4" aria-hidden />
                        </button>
                      </form>
                      <form action={moveMission.bind(null, e.id, m.id, 1)}>
                        <button disabled={i === missions.length - 1} className="grid size-8 place-items-center rounded-full hover:bg-muted disabled:opacity-30" aria-label="Move down">
                          <ArrowDown className="size-4" aria-hidden />
                        </button>
                      </form>
                      <Confirm
                        action={deleteMission.bind(null, e.id, m.id)}
                        title="Delete this mission?"
                        message={m.count ? `Its ${m.count} photo${m.count === 1 ? "" : "s"} stay in the album, just without the mission.` : "Guests won't see it any more."}
                        confirm="Delete mission"
                        label="Delete mission"
                        className="grid size-8 place-items-center rounded-full text-danger hover:bg-danger-soft"
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </Confirm>
                    </div>
                    {b?.people.length ? (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-11 text-xs">
                        <span className="font-semibold text-muted-foreground">⚡ Fastest:</span>
                        {b.people.slice(0, 3).map((p, j) => (
                          <span key={p.id} className="rounded-full bg-muted px-2 py-0.5 font-semibold">
                            {MEDALS[j]} {p.name ?? "Guest"} · {time(p.at)}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">No missions yet. Add your own, or start with the wedding pack.</p>
          )}
          <ActionForm action={addMission.bind(null, e.id)} submit="Add mission" pending="Adding…">
            <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-3">
              <Field label="Emoji">
                <Input name="emoji" maxLength={8} placeholder="📸" className="text-center text-xl" />
              </Field>
              <Field label="Mission">
                <Input name="title" required maxLength={80} placeholder="Selfie with the bride's mum" />
              </Field>
            </div>
          </ActionForm>
        </Card>

        <Card className="grid content-start gap-3 bg-gradient-to-br from-[#fff4e0] to-brand-soft">
          <h2 className="text-lg font-bold">🏆 Mission masters</h2>
          <p className="text-sm text-muted-foreground">Guests who completed every mission, fastest first. Perfect for a prize at the end!</p>
          {board.finishers.length ? (
            <ol className="grid gap-2">
              {board.finishers.map((x, i) => (
                <li key={x.id} className="flex items-center gap-3 rounded-xl bg-card px-3 py-2 shadow-soft">
                  <span className="w-7 text-center text-xl">{MEDALS[i] ?? <span className="text-sm font-bold text-muted-foreground">{i + 1}</span>}</span>
                  <span className="min-w-0 flex-1 truncate font-semibold">{x.name ?? "Guest"}</span>
                  <span className="text-xs text-muted-foreground">finished {time(x.at)}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="rounded-xl bg-card/70 px-4 py-6 text-center text-sm text-muted-foreground">Nobody has finished them all yet.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
