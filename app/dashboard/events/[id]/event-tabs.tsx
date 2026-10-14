"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui";

export function EventTabs({ id, review }: { id: string; review: number }) {
  const path = usePathname();
  const base = `/dashboard/events/${id}`;
  const tabs = [
    { href: base, label: "Overview" },
    { href: `${base}/photos`, label: review ? `Photos (${review} to approve)` : "Photos" },
    { href: `${base}/settings`, label: "Settings" },
    { href: `${base}/checkout`, label: "Package" },
  ];
  return (
    <nav className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className="flex min-w-max gap-1 border-b border-border">
        {tabs.map((t) => {
          const active = t.href === base ? path === base : path.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                "-mb-px border-b-2 px-3 py-2.5 text-sm font-semibold",
                active ? "border-ink text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
