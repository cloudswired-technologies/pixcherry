import "server-only";
import { headers } from "next/headers";

// Fixed-window limiter in process memory (single VPS). Cloudflare rules sit in front.

const buckets = new Map<string, { count: number; reset: number }>();

export async function clientIp() {
  const h = await headers();
  return h.get("cf-connecting-ip") ?? h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

/** Returns true when allowed. `cost` lets one request use several slots. */
export async function rateLimit(name: string, limit: number, windowMs: number, key?: string, cost = 1) {
  const id = `${name}:${key ?? (await clientIp())}`;
  const now = Date.now();
  const b = buckets.get(id);
  if (!b || b.reset <= now) {
    if (buckets.size > 50_000) buckets.clear();
    buckets.set(id, { count: cost, reset: now + windowMs });
    return cost <= limit;
  }
  b.count += cost;
  return b.count <= limit;
}

/**
 * Guest pages: a whole venue can share one Wi-Fi IP, so a joined guest is limited per
 * phone (`guestId`, from the signed cookie; joining passed the bot check). Only people
 * who haven't joined are counted per IP, with a cap 100× looser than one phone's.
 */
export async function guestLimit(name: string, perGuest: number, windowMs: number, guestId: string | null | undefined, cost = 1) {
  if (guestId) return rateLimit(name, perGuest, windowMs, `g:${guestId}`, cost);
  return rateLimit(`${name}-anon`, perGuest * 100, windowMs, undefined, cost);
}
