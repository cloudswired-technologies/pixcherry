import { cn } from "@/components/ui";

// Real app screenshots, framed. Phone shots get a thin dark bezel; desktop shots a
// plain card edge. Images live in public/landing (made from e2e/demo.spec.ts).

export function PhoneShot({ src, alt, className, priority }: { src: string; alt: string; className?: string; priority?: boolean }) {
  return (
    <div className={cn("rounded-[2.2rem] bg-ink p-[7px] shadow-lift", className)}>
      <img
        src={src}
        alt={alt}
        width={390}
        height={844}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : undefined}
        className="block aspect-[390/844] w-full rounded-[1.8rem] bg-muted object-cover object-top"
      />
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
