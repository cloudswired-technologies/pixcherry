import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowDown, ArrowUp, Eye, EyeOff, Sparkles, Trash2 } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { Card, Field, Input, Notice, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { listMissions, listWishes } from "@/lib/engage";
import { getManagedEvent } from "@/lib/events";
import { formatDateTime } from "@/lib/format";
import { addMission, addPresetMissions, deleteMission, moveMission, toggleWish } from "../../actions";

export const metadata = { title: "Missions & wishes" };

export default async function Engage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const e = await getManagedEvent(id, user);
  if (!e || !e.paid_at) notFound();
  const f = e.cfg.features;
  const [missions, wishes] = await Promise.all([f.missions ? listMissions(e.id) : [], f.wishes ? listWishes(e.id, { includeHidden: true, limit: 500 }) : []]);

  return (
    <div className="grid gap-6">
      <PageHeader title="Missions & wishes" sub="Make it a game: give guests photo challenges, and collect their wishes for you." />

      <Card className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold">🎯 Snap missions</h2>
          {f.missions ? (
            <form action={addPresetMissions.bind(null, e.id)}>
              <button className="inline-flex h-9 items-center gap-1.5 rounded-full bg-brand-soft px-3 text-sm font-semibold text-brand-strong">
                <Sparkles className="size-4" aria-hidden /> Add the wedding pack
              </button>
            </form>
          ) : null}
        </div>
        {!f.missions ? (
          <Notice>
            Snap missions are on a higher package.{" "}
            <Link href={`/dashboard/events/${e.id}/checkout`} className="font-semibold underline">
              Upgrade
            </Link>
          </Notice>
        ) : (
          <>
            {missions.length ? (
              <ol className="grid gap-2">
                {missions.map((m, i) => (
                  <li key={m.id} className="flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-2">
                    <span className="text-xl">{m.emoji ?? "🎯"}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{m.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {m.count} photo{m.count === 1 ? "" : "s"}
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
                    <form action={deleteMission.bind(null, e.id, m.id)}>
                      <button className="grid size-8 place-items-center rounded-full text-danger hover:bg-danger-soft" aria-label="Delete mission">
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    </form>
                  </li>
                ))}
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
          </>
        )}
      </Card>

      <Card className="grid gap-4">
        <h2 className="text-lg font-bold">💌 Wishes</h2>
        {!f.wishes ? (
          <Notice>The wishes wall is not in this package.</Notice>
        ) : wishes.length ? (
          <ul className="grid gap-2">
            {wishes.map((w) => (
              <li key={w.id} className={`flex items-start gap-3 rounded-xl border border-border p-3 ${w.hidden ? "bg-muted opacity-60" : "bg-background"}`}>
                {w.photo ? <img src={w.photo} alt="" className="size-14 shrink-0 rounded-lg object-cover" /> : null}
                <div className="min-w-0 flex-1">
                  <p className="whitespace-pre-line text-sm">{w.message}</p>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {w.name ?? "A guest"} · {formatDateTime(w.at)}
                    {w.hidden ? " · hidden" : ""}
                  </div>
                </div>
                <form action={toggleWish.bind(null, e.id, w.id, !w.hidden)}>
                  <button className="inline-flex h-8 items-center gap-1 rounded-full bg-muted px-3 text-xs font-semibold" title={w.hidden ? "Show on the wall again" : "Hide from the wall"}>
                    {w.hidden ? <Eye className="size-3.5" aria-hidden /> : <EyeOff className="size-3.5" aria-hidden />}
                    {w.hidden ? "Show" : "Hide"}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No wishes yet. They appear here as guests write them.</p>
        )}
      </Card>
    </div>
  );
}
