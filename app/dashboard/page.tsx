import Link from "next/link";
import { CalendarDays, Images, Plus, Users } from "lucide-react";
import { PhaseBadge } from "@/components/event-bits";
import { Card, LinkButton, Notice, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { coverUrl, listOwnerEvents } from "@/lib/events";
import { formatDate } from "@/lib/format";
import { eventPhase } from "@/lib/limits";

export const metadata = { title: "My events" };

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const { deleted } = await searchParams;
  const user = await requireUser();
  const all = await listOwnerEvents(user.id);
  // Deleted events leave the list; their receipts stay reachable below.
  const events = all.filter((e) => !e.purged_at);
  const gone = all.filter((e) => e.purged_at);
  return (
    <div className="grid gap-6">
      <PageHeader
        title="My events"
        actions={
          <LinkButton href="/dashboard/events/new" variant="brand">
            <Plus aria-hidden /> New event
          </LinkButton>
        }
      />
      {deleted ? <Notice tone="ok">The event was deleted.</Notice> : null}
      {events.length === 0 ? (
        <Card className="grid place-items-center gap-3 py-14 text-center">
          <Images className="size-10 text-muted-foreground" aria-hidden />
          <h2 className="text-lg font-bold">No events yet</h2>
          <p className="max-w-sm text-sm text-muted-foreground">Create your first event to get a QR code your guests can scan to share their photos.</p>
          <LinkButton href="/dashboard/events/new" variant="brand">
            Create your event
          </LinkButton>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((e) => {
            const cover = coverUrl(e);
            return (
              <Link key={e.id} href={`/dashboard/events/${e.id}`} className="group overflow-hidden rounded-2xl border border-border bg-card shadow-soft transition-shadow hover:shadow-lift">
                <div className="aspect-[16/7] bg-gradient-to-br from-brand-soft to-muted">
                  {cover ? <img src={cover} alt="" className="size-full object-cover" /> : null}
                </div>
                <div className="grid gap-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="min-w-0 truncate font-bold group-hover:underline">{e.name}</h2>
                    <PhaseBadge phase={eventPhase(e)} />
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="size-4" aria-hidden /> {formatDate(e.starts_at)}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Images className="size-4" aria-hidden /> {e.photo_count.toLocaleString("en-MY")}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Users className="size-4" aria-hidden /> {e.guest_count.toLocaleString("en-MY")}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
      {gone.length ? (
        <details className="rounded-2xl border border-border bg-card p-4 text-sm">
          <summary className="cursor-pointer font-semibold text-muted-foreground">Deleted events ({gone.length})</summary>
          <ul className="mt-3 divide-y divide-border">
            {gone.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0 truncate">
                  {e.name} <span className="text-muted-foreground">· {formatDate(e.starts_at)}</span>
                </span>
                <Link href={`/dashboard/events/${e.id}`} className="shrink-0 font-semibold text-brand">
                  Receipts
                </Link>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
