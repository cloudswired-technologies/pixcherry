"use client";

import { useEffect, useRef } from "react";

// Cloudflare Turnstile, rendered explicitly so the form knows when the token is
// ready (`onToken`) and gets a fresh one after expiry. The widget adds a hidden
// `cf-turnstile-response` input to the surrounding form.

type Api = {
  render(el: HTMLElement, opts: Record<string, unknown>): string;
  reset(id: string): void;
  remove(id: string): void;
};
declare global {
  interface Window {
    turnstile?: Api;
  }
}

let loading: Promise<Api> | null = null;
function loadApi() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  loading ??= new Promise<Api>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("turnstile")));
    s.onerror = () => {
      loading = null;
      reject(new Error("turnstile"));
    };
    document.head.appendChild(s);
  });
  return loading;
}

export function Turnstile({ siteKey, onToken, onInteractive }: { siteKey: string; onToken?: (token: string | null) => void; onInteractive?: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const cb = useRef(onToken);
  const ask = useRef(onInteractive);
  useEffect(() => {
    cb.current = onToken;
    ask.current = onInteractive;
  });
  useEffect(() => {
    let id: string | null = null;
    let gone = false;
    loadApi()
      .then((api) => {
        if (gone || !box.current) return;
        id = api.render(box.current, {
          sitekey: siteKey,
          size: "flexible",
          appearance: "interaction-only",
          callback: (t: string) => cb.current?.(t),
          "expired-callback": () => {
            cb.current?.(null);
            if (id) api.reset(id);
          },
          "error-callback": () => cb.current?.(null),
          // Cloudflare wants a tick in the box ("Verify you are human").
          "before-interactive-callback": () => ask.current?.(),
        });
      })
      .catch(() => cb.current?.(null));
    return () => {
      gone = true;
      if (id) window.turnstile?.remove(id);
    };
  }, [siteKey]);
  return <div ref={box} />;
}
