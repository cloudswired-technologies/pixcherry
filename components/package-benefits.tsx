import { Check, X } from "lucide-react";
import { cn } from "@/components/ui";
import type { EventConfig } from "@/lib/limits";
import { FEATURES, LIMITS, qualityLabel } from "@/lib/plan-schema";

// Everything an event's package gives, in plain words: the limits (with what
// add-ons added on top) and every feature, included or not.

export function PackageBenefits({ cfg, addons = {}, compact }: { cfg: EventConfig; addons?: Record<string, number>; compact?: boolean }) {
  const limits = LIMITS.filter((l) => l.pricing);
  const on = FEATURES.filter((f) => cfg.features[f.key]);
  const off = FEATURES.filter((f) => !cfg.features[f.key]);
  return (
    <div className={cn("grid gap-4", compact ? "" : "md:grid-cols-2")}>
      <ul className="grid content-start gap-2 text-sm">
        {limits.map((l) => (
          <li key={l.key} className="flex items-start gap-2.5">
            <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-brand text-white">
              <Check className="size-3" strokeWidth={3} aria-hidden />
            </span>
            <span>
              {l.pricing!(cfg.limits[l.key])}
              {addons[l.key] ? <span className="ml-1.5 rounded-full bg-ok-soft px-2 py-0.5 text-[11px] font-bold text-ok">+{addons[l.key].toLocaleString("en-MY")} add-on</span> : null}
            </span>
          </li>
        ))}
        <li className="flex items-start gap-2.5">
          <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-brand text-white">
            <Check className="size-3" strokeWidth={3} aria-hidden />
          </span>
          {qualityLabel()}
        </li>
      </ul>
      <ul className="grid content-start gap-2 text-sm">
        {on.map((f) => (
          <li key={f.key} className="flex items-start gap-2.5">
            <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-ok text-white">
              <Check className="size-3" strokeWidth={3} aria-hidden />
            </span>
            <span>
              <span className="font-semibold">{f.pricing}</span>
              {compact ? null : <span className="block text-xs text-muted-foreground">{f.help}</span>}
            </span>
          </li>
        ))}
        {off.map((f) => (
          <li key={f.key} className="flex items-start gap-2.5 text-muted-foreground">
            <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-muted">
              <X className="size-3" strokeWidth={3} aria-hidden />
            </span>
            <span className="line-through decoration-muted-foreground/40">{f.pricing}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
