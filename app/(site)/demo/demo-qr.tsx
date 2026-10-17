"use client";

import { useEffect, useState } from "react";
import { Check, Copy, QrCode, X } from "lucide-react";

// "Show QR" on a phone: a big code the second phone can scan off this screen.

export function DemoQr({ name, url, qrSvg }: { name: string; url: string; qrSvg: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (http, old browser): the link is on screen to copy by hand.
    }
  };
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-border bg-white px-4 text-sm font-semibold text-ink hover:bg-muted"
      >
        <QrCode className="size-4" aria-hidden /> Show QR
      </button>
      {open ? (
        <div className="fixed inset-0 z-[90] grid place-items-end bg-ink/60 p-3 backdrop-blur-sm sm:place-items-center" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`QR code for ${name}`}
            className="relative w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-lift [animation:pc-rise_0.2s_ease]"
            onClick={(e) => e.stopPropagation()}
          >
            <button type="button" onClick={() => setOpen(false)} className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-muted" aria-label="Close">
              <X className="size-4" aria-hidden />
            </button>
            <p className="text-sm font-bold text-brand">Scan with your second phone</p>
            <h2 className="mt-1 text-lg font-extrabold leading-tight">{name}</h2>
            <div className="mx-auto mt-4 w-full max-w-64 rounded-2xl bg-white p-2 ring-1 ring-border [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: qrSvg }} />
            <button type="button" onClick={copy} className="mx-auto mt-4 inline-flex max-w-full items-center gap-2 rounded-full bg-muted px-4 py-2 text-sm font-semibold">
              <span className="truncate">{url.replace(/^https?:\/\//, "")}</span>
              {copied ? <Check className="size-4 shrink-0 text-ok" aria-hidden /> : <Copy className="size-4 shrink-0" aria-hidden />}
            </button>
            <p className="mt-3 text-xs text-muted-foreground">Or send the link to the other phone on WhatsApp.</p>
          </div>
        </div>
      ) : null}
    </>
  );
}
