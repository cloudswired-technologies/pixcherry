import { cn } from "@/components/ui";

// PixCherry logo, redrawn from the brand guide: camera brackets + cherry + leaf.

export function LogoMark({ className, mono }: { className?: string; mono?: "light" }) {
  const ink = mono === "light" ? "#ffffff" : "#1f2937";
  return (
    <svg viewBox="0 0 120 104" className={cn("shrink-0", className)} aria-hidden>
      {/* camera brackets */}
      <path d="M34 28H22a10 10 0 0 0-10 10v38a10 10 0 0 0 10 10h12" fill="none" stroke={ink} strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M86 28h12a10 10 0 0 1 10 10v38a10 10 0 0 1-10 10H86" fill="none" stroke={ink} strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
      {/* stem + leaf */}
      <path d="M60 46c0-14 4-26 14-34" fill="none" stroke={ink} strokeWidth="5" strokeLinecap="round" />
      <path d="M72 14c6-10 18-14 30-12-3 12-13 20-26 20-3 0-4-4-4-8z" fill="#16a34a" />
      {/* cherry */}
      <circle cx="60" cy="64" r="24" fill="#e91d48" />
      <circle cx="69" cy="55" r="6" fill="#ffffff" />
    </svg>
  );
}

export function Logo({ className, tagline, light }: { className?: string; tagline?: boolean; light?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark className="h-[1.6em] w-auto" mono={light ? "light" : undefined} />
      <span className="grid leading-none">
        <span className="font-extrabold tracking-tight">
          <span className={light ? "text-white" : "text-ink"}>Pix</span>
          <span className="text-brand">Cherry</span>
        </span>
        {tagline ? <span className={cn("mt-1 text-[0.42em] font-semibold uppercase tracking-[0.28em]", light ? "text-white/70" : "text-ink/80")}>Share your best moment</span> : null}
      </span>
    </span>
  );
}
