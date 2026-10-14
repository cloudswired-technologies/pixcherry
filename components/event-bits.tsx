import { Badge } from "@/components/ui";
import type { EventPhase } from "@/lib/limits";

const PHASE: Record<EventPhase, { label: string; tone: "neutral" | "ok" | "warn" | "danger" | "brand" }> = {
  draft: { label: "Not paid", tone: "warn" },
  upcoming: { label: "Upcoming", tone: "brand" },
  live: { label: "Live now", tone: "ok" },
  ended: { label: "Ended", tone: "neutral" },
  deleted: { label: "Photos deleted", tone: "danger" },
};

export function PhaseBadge({ phase }: { phase: EventPhase }) {
  const p = PHASE[phase];
  return <Badge tone={p.tone}>{p.label}</Badge>;
}

export function Meter({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" role="presentation">
      <div className={`h-full rounded-full ${pct > 90 ? "bg-danger" : pct > 70 ? "bg-warn" : "bg-ink"}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
