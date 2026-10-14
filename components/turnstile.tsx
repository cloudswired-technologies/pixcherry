"use client";

import Script from "next/script";

/** Cloudflare Turnstile widget; adds `cf-turnstile-response` to the surrounding form. */
export function Turnstile({ siteKey }: { siteKey: string }) {
  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />
      <div className="cf-turnstile" data-sitekey={siteKey} data-size="flexible" data-appearance="interaction-only" />
    </>
  );
}
