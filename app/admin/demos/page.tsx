import Link from "next/link";
import { ExternalLink, Trash2 } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { Confirm } from "@/components/confirm";
import { Card, PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { q } from "@/lib/db";
import { DEMO_HOURS, DEMO_SHOTS, DEMOS, listDemoCards } from "@/lib/demo";
import { guestUrl } from "@/lib/events";
import { clearDemo, setupDemos } from "./actions";

export const metadata = { title: "Demo albums" };
export const dynamic = "force-dynamic";

export default async function DemosAdmin() {
  await requireAdmin();
  const cards = await listDemoCards();
  const visitors = await q<{ event_id: string; photos: number; guests: number }>(
    `select e.id as event_id,
       (select count(*)::int from photos p left join guests g on g.id = p.guest_id where p.event_id = e.id and p.status in ('ready','review') and not coalesce(g.is_seed, false)) photos,
       (select count(*)::int from guests g where g.event_id = e.id and not g.is_seed) guests
     from events e where e.is_demo`,
  );
  const v = new Map(visitors.map((r) => [r.event_id, r]));
  return (
    <div className="grid max-w-4xl gap-6">
      <PageHeader
        title="Demo albums"
        sub={
          <>
            Ready-made Exclusive events shown on{" "}
            <Link href="/demo" className="font-semibold text-brand hover:underline">
              pixcherry.com/demo
            </Link>
            . They never expire. Visitors get {DEMO_SHOTS} shots per phone, and what they add clears {DEMO_HOURS} hours later. The sample photos stay.
          </>
        }
      />
      <Card>
        <ActionForm action={setupDemos} submit={cards.length ? "Refresh demo albums" : "Set up demo albums"} pending="Setting up…">
          <p className="text-sm text-muted-foreground">
            Creates any missing demo album ({DEMOS.length} in total) with its sample photos, missions and wishes, and refreshes the names and texts of
            the ones that exist. Visitors&apos; photos are not touched.
          </p>
        </ActionForm>
      </Card>
      {cards.length ? (
        <Card className="grid gap-1 p-2">
          {cards.map((c) => {
            const n = v.get(c.id);
            return (
              <div key={c.id} className="flex flex-wrap items-center gap-3 rounded-2xl p-3 hover:bg-muted/60">
                {c.cover ? <img src={c.cover} alt="" className="h-12 w-20 rounded-xl object-cover" /> : <div className="h-12 w-20 rounded-xl bg-muted" />}
                <div className="min-w-0 flex-1 basis-40">
                  <div className="line-clamp-2 font-bold sm:truncate">
                    {c.emoji} {c.name}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {c.photoCount} photos · visitors now: {n?.photos ?? 0} photos, {n?.guests ?? 0} phones
                  </div>
                </div>
                <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                <a href={guestUrl(c.liveSlug)} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-3 text-sm font-semibold hover:bg-muted">
                  Open <ExternalLink className="size-3.5" aria-hidden />
                </a>
                <Link href={`/dashboard/events/${c.id}`} className="inline-flex h-9 items-center rounded-full border border-border px-3 text-sm font-semibold hover:bg-muted">
                  Host view
                </Link>
                <Confirm
                  action={clearDemo.bind(null, c.id)}
                  title={`Clear visitors from ${c.name}?`}
                  message="Every photo, wish and heart that visitors added goes now, not after 24 hours. The sample photos stay."
                  confirm="Clear now"
                  label="Clear visitors' photos"
                  className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-3 text-sm font-semibold text-danger hover:bg-danger-soft"
                >
                  <Trash2 className="size-3.5" aria-hidden /> Clear
                </Confirm>
                </div>
              </div>
            );
          })}
        </Card>
      ) : null}
    </div>
  );
}
