"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Camera, Check, ChevronDown, ExternalLink, LayoutDashboard, Smartphone } from "lucide-react";
import { cn } from "@/components/ui";

// "Getting started" for hosts: what this dashboard is (host view) versus the
// guest app (where photos are taken), and the few steps to a great album, each
// ticked off automatically. Folds away once everything is done or when closed.

export type GuideStep = { key: string; title: string; text: string; href: string; done: boolean; external?: boolean };

export function EventGuide({ eventId, guestUrl, qrSvg, steps }: { eventId: string; guestUrl: string; qrSvg: string; steps: GuideStep[] }) {
  const done = steps.filter((s) => s.done).length;
  const all = done === steps.length;
  const storeKey = `pc-guide-${eventId}`;
  const [open, setOpen] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        if (localStorage.getItem(storeKey) === "closed" || all) setOpen(false);
      } catch {
        /* storage blocked */
      }
    }, 0);
    return () => clearTimeout(t);
  }, [storeKey, all]);
  const toggle = () => {
    setOpen((v) => {
      try {
        localStorage.setItem(storeKey, v ? "closed" : "open");
      } catch {
        /* storage blocked */
      }
      return !v;
    });
  };

  return (
    <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-soft" aria-label="Getting started">
      <button type="button" onClick={toggle} className="flex w-full items-center gap-3 p-5 text-left" aria-expanded={open}>
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-brand-soft text-lg">🚀</span>
        <span className="min-w-0 flex-1">
          <span className="block text-lg font-bold">{all ? "You're all set!" : "Getting started"}</span>
          <span className="block text-sm text-muted-foreground">
            {done} of {steps.length} done{all ? " — enjoy your event." : " — a few steps to a great album."}
          </span>
        </span>
        <span className="hidden h-2 w-28 overflow-hidden rounded-full bg-muted sm:block">
          <span className="block h-full rounded-full bg-brand" style={{ width: `${(done / steps.length) * 100}%` }} />
        </span>
        <ChevronDown className={cn("size-5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} aria-hidden />
      </button>

      {open ? (
        <div className="grid gap-5 border-t border-border p-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <div className="grid content-start gap-4">
            <div className="grid gap-2 rounded-2xl bg-canvas p-4 text-sm sm:grid-cols-2">
              <div className="flex gap-3">
                <LayoutDashboard className="mt-0.5 size-5 shrink-0 text-ink" aria-hidden />
                <div>
                  <div className="font-bold">Host dashboard (here)</div>
                  <div className="text-muted-foreground">Set up the event, see every photo, manage guests, download the album.</div>
                </div>
              </div>
              <div className="flex gap-3">
                <Camera className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden />
                <div>
                  <div className="font-bold">Guest app</div>
                  <div className="text-muted-foreground">Where everyone — you too — snaps, uploads, hearts photos and writes wishes.</div>
                </div>
              </div>
            </div>
            <ol className="grid gap-2">
              {steps.map((s, i) => {
                const inner = (
                  <>
                    <span className={cn("grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold", s.done ? "bg-ok text-white" : "bg-muted text-ink")}>
                      {s.done ? <Check className="size-4" aria-label="Done" /> : i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn("block font-semibold", s.done && "text-muted-foreground line-through")}>{s.title}</span>
                      <span className="block text-sm text-muted-foreground">{s.text}</span>
                    </span>
                    {s.external ? <ExternalLink className="size-4 shrink-0 text-muted-foreground" aria-hidden /> : null}
                  </>
                );
                const cls = "flex items-center gap-3 rounded-2xl border border-border px-3 py-2.5 hover:bg-muted/60";
                return (
                  <li key={s.key}>
                    {s.external ? (
                      <a href={s.href} target="_blank" rel="noreferrer" className={cls}>
                        {inner}
                      </a>
                    ) : (
                      <Link href={s.href} className={cls}>
                        {inner}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
          <div className="grid content-start justify-items-center gap-3 rounded-2xl bg-gradient-to-br from-brand-soft to-[#fff1e3] p-5 text-center">
            <div className="flex items-center gap-2 font-bold">
              <Smartphone className="size-5 text-brand" aria-hidden /> Snap photos yourself
            </div>
            <p className="text-sm text-muted-foreground">Scan with your phone to open the guest app — the Snap button is there.</p>
            <div className="w-40 rounded-2xl bg-white p-2 shadow-soft [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: qrSvg }} />
            <a href={guestUrl} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-full bg-brand px-4 text-sm font-bold text-white shadow-cherry">
              <Camera className="size-4" aria-hidden /> Open guest app
            </a>
          </div>
        </div>
      ) : null}
    </section>
  );
}
