import "server-only";

// A few seconds of cache for album-wide answers every open guest page asks for
// (counts, leaderboards, folders, missions): database work grows with albums, not
// with guests, and only one query per key runs at a time however many phones ask.

const store = new Map<string, { at: number; value?: unknown; pending?: Promise<unknown> }>();

export async function memo<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && now - hit.at < ttlMs) return (hit.pending ?? hit.value) as T;
  const pending = fn();
  store.set(key, { at: now, value: hit?.value, pending });
  try {
    const value = await pending;
    store.set(key, { at: Date.now(), value });
    if (store.size > 5000) for (const [k, v] of store) if (Date.now() - v.at > 60_000) store.delete(k);
    return value;
  } catch (err) {
    store.delete(key);
    throw err;
  }
}
