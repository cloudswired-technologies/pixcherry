"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui";

const ITEMS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/events", label: "Events" },
  { href: "/admin/plans", label: "Packages" },
  { href: "/admin/quality", label: "Photo quality" },
  { href: "/admin/addons", label: "Add-ons" },
  { href: "/admin/promos", label: "Promo codes" },
  { href: "/admin/settings", label: "Settings" },
  { href: "/admin/logs", label: "Logs" },
];

export function AdminNav() {
  const path = usePathname();
  return (
    <nav className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
      <ul className="flex min-w-max gap-1 lg:min-w-0 lg:flex-col">
        {ITEMS.map((i) => {
          const active = i.href === "/admin" ? path === "/admin" : path.startsWith(i.href);
          return (
            <li key={i.href}>
              <Link
                href={i.href}
                className={cn("block rounded-xl px-3 py-2 text-sm font-medium", active ? "bg-ink text-white" : "text-muted-foreground hover:bg-muted hover:text-foreground")}
              >
                {i.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
