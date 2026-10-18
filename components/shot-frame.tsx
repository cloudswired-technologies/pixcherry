import { cn } from "@/components/ui";

// Real app screenshots, framed. A phone shot gets a phone drawn to scale: every size is in container
// units (cqw = % of the phone's width), so a small phone keeps a real phone's thin bezel and ~13%
// corners instead of turning into a pill. The status bar (with the dynamic island) sits above the
// screenshot in the colour of the screenshot's top edge: light app pages, dark camera/viewer
// screens, or dim when a sheet's backdrop covers the page. Desktop shots get a plain card edge.

export type ShotTone = "light" | "dark" | "dim";

const BAR: Record<ShotTone, string> = {
  light: "bg-[#fefefe] text-ink",
  dark: "bg-[#0c0b0e] text-white",
  dim: "bg-[#7f7f7f] text-black/75",
};

const RIM = "bg-[#3b4049]";

export function PhoneShot({ src, alt, className, priority, tone = "light" }: { src: string; alt: string; className?: string; priority?: boolean; tone?: ShotTone }) {
  return (
    <div className={cn("@container", className)}>
      <div className="relative rounded-[13cqw] bg-[#0e0f12] p-[2.2cqw] shadow-lift ring-[1.5px] ring-[#3b4049]">
        <span aria-hidden className={cn("absolute -left-[1cqw] top-[16%] h-[4.5%] w-[1cqw] rounded-l-full", RIM)} />
        <span aria-hidden className={cn("absolute -left-[1cqw] top-[24%] h-[8%] w-[1cqw] rounded-l-full", RIM)} />
        <span aria-hidden className={cn("absolute -left-[1cqw] top-[34%] h-[8%] w-[1cqw] rounded-l-full", RIM)} />
        <span aria-hidden className={cn("absolute -right-[1cqw] top-[26%] h-[12%] w-[1cqw] rounded-r-full", RIM)} />
        <div className="overflow-hidden rounded-[10.8cqw] bg-muted">
          <div aria-hidden className={cn("relative flex h-[11.5cqw] items-center justify-between px-[8cqw] text-[length:3.8cqw] font-semibold tabular-nums", BAR[tone])}>
            <span>9:41</span>
            <span className="absolute left-1/2 top-[2cqw] h-[7.4cqw] w-[26cqw] -translate-x-1/2 rounded-full bg-black" />
            <span className="flex items-center gap-[1.3cqw]">
              <svg viewBox="0 0 18 12" className="h-[2.7cqw] w-auto" fill="currentColor">
                <rect x="0" y="8" width="3" height="4" rx="1" />
                <rect x="5" y="5.5" width="3" height="6.5" rx="1" />
                <rect x="10" y="3" width="3" height="9" rx="1" />
                <rect x="15" y="0" width="3" height="12" rx="1" />
              </svg>
              <svg viewBox="0 0 16 12" className="h-[2.7cqw] w-auto" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M1.5 4.3a9.5 9.5 0 0 1 13 0" />
                <path d="M4.2 7.1a5.7 5.7 0 0 1 7.6 0" />
                <path d="M6.9 9.9a1.8 1.8 0 0 1 2.2 0" />
              </svg>
              <svg viewBox="0 0 27 13" className="h-[2.8cqw] w-auto">
                <rect x="0.75" y="0.75" width="22.5" height="11.5" rx="3.5" fill="none" stroke="currentColor" strokeOpacity="0.45" strokeWidth="1.5" />
                <rect x="2.5" y="2.5" width="19" height="8" rx="2" fill="currentColor" />
                <path d="M25 4.6v3.8a2 2 0 0 0 0-3.8z" fill="currentColor" fillOpacity="0.45" />
              </svg>
            </span>
          </div>
          <img
            src={src}
            alt={alt}
            width={390}
            height={844}
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : undefined}
            className="block aspect-[390/844] w-full object-cover object-top"
          />
        </div>
      </div>
    </div>
  );
}

export function DeskShot({ src, alt, className }: { src: string; alt: string; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-2xl border border-border bg-white shadow-lift", className)}>
      <img src={src} alt={alt} width={1440} height={900} loading="lazy" className="block aspect-[1440/900] w-full object-cover object-top" />
    </div>
  );
}
