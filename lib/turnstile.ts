import "server-only";
import { clientIp } from "@/lib/rate-limit";

// Cloudflare Turnstile. Active only when both keys are set (production);
// without them (local dev, tests) every check passes.

export function turnstileSiteKey(): string | null {
  const key = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  return key && process.env.TURNSTILE_SECRET_KEY ? key : null;
}

export async function verifyTurnstile(token: string | null | undefined): Promise<boolean> {
  if (!turnstileSiteKey()) return true;
  if (!token || token.length > 2048) return false;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ secret: process.env.TURNSTILE_SECRET_KEY, response: token, remoteip: await clientIp() }),
      signal: AbortSignal.timeout(8_000),
      cache: "no-store",
    });
    return ((await res.json()) as { success?: boolean }).success === true;
  } catch (e) {
    // Cloudflare unreachable: don't lock real guests out; rate limits still apply.
    console.error("Turnstile verify failed", e);
    return true;
  }
}
