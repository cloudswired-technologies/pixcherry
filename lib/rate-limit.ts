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
