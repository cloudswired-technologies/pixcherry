"use client";

import { useEffect, useState } from "react";
import { Copy, Download, MoreVertical, PlusSquare, Share } from "lucide-react";

// "Keep this album on your phone": guests who close the browser kept losing the
// album and had to find the QR code again. Installing the album (PWA) puts an
// icon on the home screen that reopens it, already signed in.

type InstallPrompt = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
export type Platform = "standalone" | "ios" | "android" | "inapp" | "desktop";

function detect(): Platform {
  const nav = navigator as Navigator & { standalone?: boolean };
  if (window.matchMedia("(display-mode: standalone)").matches || nav.standalone) return "standalone";
  const ua = navigator.userAgent;
  // In-app browsers (Instagram, Facebook, TikTok…) can't install; send them to the real browser.
  if (/FBAN|FBAV|Instagram|Line\/|MicroMessenger|TikTok|musical_ly|Snapchat|; wv\)/i.test(ua)) return "inapp";
  if (/iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "desktop";
}

export function useInstall() {
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setPlatform(detect()), 0);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPrompt);
    };
    const onInstalled = () => setPlatform("standalone");
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    navigator.serviceWorker?.register("/sw.js").catch(() => {});
    return () => {
      clearTimeout(t);
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);
  const install = async () => {
    if (!prompt) return false;
    await prompt.prompt();
    const r = await prompt.userChoice.catch(() => ({ outcome: "dismissed" as const }));
    setPrompt(null);
    return r.outcome === "accepted";
  };
  return { platform, canPrompt: !!prompt, install };
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 rounded-2xl bg-background px-3 py-3">
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand text-sm font-bold text-white">{n}</span>
      <span className="min-w-0 text-sm">{children}</span>
    </li>
  );
}

export function InstallGuide({
  platform,
  canPrompt,
  onInstall,
  link,
  onDone,
}: {
  platform: Platform;
  canPrompt: boolean;
  onInstall: () => void;
  link: string;
  onDone: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const copy = () => navigator.clipboard?.writeText(link).then(() => setCopied(true));
  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-3">
        <img src="/icon-192.png" alt="" className="size-14 rounded-2xl shadow-soft" />
        <p className="text-sm text-muted-foreground">
          Add this album to your home screen. If you close it, just tap the icon to come back — <strong className="text-ink">no QR code needed</strong>.
        </p>
      </div>

      {platform === "inapp" ? (
        <ol className="grid gap-2">
          <Step n={1}>
            Tap <MoreVertical className="inline size-4 align-text-bottom" aria-label="menu" /> or <strong>•••</strong> at the top
          </Step>
          <Step n={2}>
            Choose <strong>Open in browser</strong> (Safari or Chrome)
          </Step>
          <Step n={3}>Then add it to your home screen from there</Step>
        </ol>
      ) : platform === "ios" ? (
        <ol className="grid gap-2">
          <Step n={1}>
            Tap <Share className="inline size-4 align-text-bottom text-[#0a84ff]" aria-label="Share" /> <strong>Share</strong> in the Safari toolbar
          </Step>
          <Step n={2}>
            Scroll down and tap <PlusSquare className="inline size-4 align-text-bottom" aria-hidden /> <strong>Add to Home Screen</strong>
          </Step>
          <Step n={3}>
            Tap <strong>Add</strong> — done!
          </Step>
        </ol>
      ) : canPrompt ? (
        <button type="button" onClick={onInstall} className="inline-flex h-13 items-center justify-center gap-2 rounded-full bg-brand py-3.5 font-bold text-white shadow-cherry">
          <Download className="size-5" aria-hidden /> Add to home screen
        </button>
      ) : (
        <ol className="grid gap-2">
          <Step n={1}>
            Open your browser menu <MoreVertical className="inline size-4 align-text-bottom" aria-label="menu" />
          </Step>
          <Step n={2}>
            Tap <strong>Add to Home screen</strong> or <strong>Install app</strong>
          </Step>
        </ol>
      )}

      <div className="rounded-2xl border border-dashed border-border px-3 py-2.5 text-sm">
        <div className="text-xs text-muted-foreground">Or remember the link:</div>
        <div className="flex items-center justify-between gap-2">
          <strong className="min-w-0 truncate">{link.replace(/^https?:\/\//, "")}</strong>
          <button type="button" onClick={copy} className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-brand">
            <Copy className="size-3.5" aria-hidden /> {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>

      <button type="button" onClick={onDone} className="py-1 text-sm font-semibold text-muted-foreground">
        Not now
      </button>
    </div>
  );
}
