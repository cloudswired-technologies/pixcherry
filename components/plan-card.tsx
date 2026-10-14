import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/components/ui";
import { formatMoney } from "@/lib/format";
import { FEATURES, LIMITS, qualityLabel } from "@/lib/plan-schema";
import type { Plan } from "@/lib/plans";

/** Marketing lines for a plan, generated from its settings (nothing hard-coded per plan). */
export function planLines(p: Pick<Plan, "limits" | "features" | "quality" | "highlights">) {
  const lines: string[] = [];
  for (const l of LIMITS) if (l.pricing) lines.push(l.pricing(p.limits[l.key]));
  lines.push(qualityLabel(p.quality));
  for (const f of FEATURES) if (p.features[f.key]) lines.push(f.pricing);
  return [...lines, ...p.highlights];
}

export function PlanCard({ plan, action, compact }: { plan: Plan; action?: ReactNode; compact?: boolean }) {
  return (
    <div className={cn("relative flex flex-col rounded-3xl border bg-white p-6 shadow-soft", plan.is_featured ? "border-brand shadow-cherry" : "border-border")}>
      {plan.is_featured ? (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand px-3 py-1 text-xs font-bold text-white">Most popular</span>
      ) : null}
      <div className="text-lg font-bold">{plan.name}</div>
      {plan.description ? <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p> : null}
      <div className="mt-4 flex items-baseline gap-1.5">
        <span className="text-4xl font-extrabold tracking-tight">{formatMoney(plan.price_cents)}</span>
        <span className="text-sm text-muted-foreground">per event</span>
      </div>
      <ul className={cn("mt-5 grid gap-2.5 text-sm", compact && "text-[13px]")}>
        {planLines(plan).map((l) => (
          <li key={l} className="flex gap-2.5">
            <span className="mt-0.5 grid size-4.5 shrink-0 place-items-center rounded-full bg-brand text-white">
              <Check className="size-3" strokeWidth={3} aria-hidden />
            </span>
            <span>{l}</span>
          </li>
        ))}
      </ul>
      {action ? <div className="mt-auto pt-6">{action}</div> : null}
    </div>
  );
}
