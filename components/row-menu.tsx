"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/components/ui";

// "⋯" button with a small menu of row actions (move, delete…), so a row's title gets the full width
// on phones. Items are any elements (forms with buttons, <Confirm>…). Closes on outside tap or Escape.

export function RowMenu({ label = "More actions", children, className }: { label?: string; children: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      // A confirm dialog opened from the menu lives inside it, so taps there don't close it.
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", away);
    window.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      window.removeEventListener("keydown", esc);
    };
  }, [open]);
  return (
    <div ref={box} className={cn("relative shrink-0", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={label}
        aria-expanded={open}
        className="grid size-10 place-items-center rounded-full text-muted-foreground hover:bg-muted"
      >
        <MoreHorizontal className="size-5" aria-hidden />
      </button>
      {open ? (
        <div role="menu" className="absolute right-0 top-11 z-20 grid min-w-44 gap-0.5 rounded-2xl border border-border bg-card p-1.5 shadow-lift [animation:pc-rise_0.15s_ease]">
          {children}
        </div>
      ) : null}
    </div>
  );
}

/** Class for a menu item (a <button> inside a form, or a <Confirm> trigger). */
export const menuItem = "flex h-10 w-full items-center gap-2.5 rounded-xl px-3 text-left text-sm font-semibold hover:bg-muted disabled:pointer-events-none disabled:opacity-35";
