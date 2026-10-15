import "server-only";
import { one } from "@/lib/db";
import { getEventBySlug } from "@/lib/events";

// "Pulse" of an album: who is uploading right now and when the newest photo
// landed. Every open guest page asks every few seconds, so the answer is cached
// per album for 2 s: database work grows with albums, not with guests.

export type Pulse = { latest: string | null; uploading: { guest: string | null; name: string | null; n: number }[] };

const TTL = 2000;
const cache = new Map<string, { at: number; value: Pulse | null; pending?: Promise<Pulse | null> }>();

async function compute(slug: string): Promise<Pulse | null> {
  const e = await getEventBySlug(slug);
  if (!e || !e.paid_at || e.purged_at) return null;
  const r = await one<{ latest: Date | null; uploading: Pulse["uploading"] | null }>(
    `select (select max(ready_at) from photos where event_id = $1 and status = 'ready') as latest,
       (select json_agg(x) from (
          select p.guest_id as guest, g.name, count(*)::int as n
          from photos p left join guests g on g.id = p.guest_id
          where p.event_id = $1 and p.status in ('pending', 'uploaded', 'processing') and p.created_at > now() - interval '5 minutes'
          group by p.guest_id, g.name order by min(p.created_at) limit 12) x) as uploading`,
    [e.id],
  );
  return { latest: r?.latest ? new Date(r.latest).toISOString() : null, uploading: r?.uploading ?? [] };
}

export async function albumPulse(slug: string) {
  const now = Date.now();
  const hit = cache.get(slug);
  if (hit && now - hit.at < TTL) return hit.pending ?? hit.value;
  // One query per album at a time, however many guests ask at once.
  const pending = compute(slug);
  cache.set(slug, { at: now, value: hit?.value ?? null, pending });
  try {
    const value = await pending;
    cache.set(slug, { at: Date.now(), value });
    if (cache.size > 5000) for (const [k, v] of cache) if (Date.now() - v.at > 60_000) cache.delete(k);
    return value;
  } catch {
    cache.delete(slug);
    return null;
  }
}
