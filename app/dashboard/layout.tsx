import { DashShell, type ShellEvent } from "@/components/dash-shell";
import { requireUser } from "@/lib/auth";
import { q } from "@/lib/db";
import { coverUrl, guestUrl, listOwnerEvents } from "@/lib/events";
import { eventPhase, type EventPhase } from "@/lib/limits";

const PHASE: Record<EventPhase, { label: string; tone: ShellEvent["phaseTone"] }> = {
  draft: { label: "Not paid", tone: "warn" },
  upcoming: { label: "Upcoming", tone: "brand" },
  live: { label: "Live now", tone: "ok" },
  ended: { label: "Ended", tone: "neutral" },
  deleted: { label: "Photos deleted", tone: "danger" },
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [events, review] = await Promise.all([
    listOwnerEvents(user.id),
    q<{ event_id: string; n: number }>(
      "select p.event_id, count(*)::int n from photos p join events e on e.id = p.event_id where e.owner_id = $1 and p.status = 'review' group by p.event_id",
      [user.id],
    ),
  ]);
  const waiting = new Map(review.map((r) => [r.event_id, r.n]));
  const list = events.map((e) => {
    const ph = PHASE[eventPhase(e)];
    const f = e.cfg.features;
    return {
      id: e.id,
      name: e.name,
      phase: ph.label,
      phaseTone: ph.tone,
      cover: coverUrl(e),
      review: waiting.get(e.id) ?? 0,
      guestUrl: e.paid_at && !e.purged_at ? guestUrl(e.slug) : null,
      features: { missions: f.missions, wishes: f.wishes },
    };
  });
  return (
    <DashShell user={{ email: user.email, name: user.name, isAdmin: user.is_admin }} events={list}>
      {children}
    </DashShell>
  );
}
