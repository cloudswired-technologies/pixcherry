"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { looksLikeImage, prepare, type Quality } from "@/lib/client/compress";

// Upload queue for the guest page: prepare (resize) → reserve → PUT straight to
// storage (with progress and retries) → confirm. Three files at a time.

export type ItemStatus = "queued" | "preparing" | "uploading" | "done" | "error";
export type Item = { key: string; name: string; preview: string; status: ItemStatus; progress: number; error?: string };

const PARALLEL = 3;
const PUT_RETRIES = 3;

class StopError extends Error {
  constructor(message: string, public stopAll = false, public needsJoin = false) {
    super(message);
  }
}

function put(url: string, blob: Blob, type: string, onProgress: (p: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", type);
    xhr.upload.onprogress = (ev) => ev.lengthComputable && onProgress(ev.loaded / ev.total);
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`storage ${xhr.status}`)));
    xhr.onerror = () => reject(new Error("network"));
    xhr.ontimeout = () => reject(new Error("timeout"));
    xhr.timeout = 120_000;
    xhr.send(blob);
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function useUploader(opts: {
  slug: string;
  quality: Quality;
  maxBytes: number;
  remaining: number;
  onUploaded: () => void;
  onNeedJoin: () => void;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(opts.remaining);
  const files = useRef(new Map<string, File>());
  const active = useRef(0);
  const queue = useRef<string[]>([]);
  const pumpRef = useRef<() => void>(() => {});
  const stopped = useRef(false);
  const optsRef = useRef(opts);
  useEffect(() => {
    optsRef.current = opts;
  });

  const patch = useCallback((key: string, p: Partial<Item>) => setItems((list) => list.map((i) => (i.key === key ? { ...i, ...p } : i))), []);

  const run = useCallback(
    async (key: string) => {
      const file = files.current.get(key)!;
      const o = optsRef.current;
      patch(key, { status: "preparing" });
      let blob: Blob;
      try {
        blob = await prepare(file, o.quality, o.maxBytes);
      } catch {
        throw new StopError(`This photo couldn't be read. Try a different one.`);
      }
      const type = blob.type && blob.type !== "application/octet-stream" ? blob.type : "image/jpeg";
      const res = await fetch(`/api/e/${o.slug}/uploads`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ files: [{ type, size: blob.size }] }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; code?: string; uploads?: { id: string; url: string }[]; remaining?: number };
      if (res.status === 401 && body.code === "join") throw new StopError("Please join first.", true, true);
      if (res.status === 409 || res.status === 403) throw new StopError(body.error ?? "Upload refused.", true);
      if (!res.ok || !body.uploads?.length) throw new StopError(body.error ?? "Upload failed. Please try again.");
      const u = body.uploads[0];
      if (typeof body.remaining === "number") setRemaining(body.remaining);

      patch(key, { status: "uploading", progress: 0 });
      let lastErr: unknown;
      for (let attempt = 0; attempt < PUT_RETRIES; attempt++) {
        try {
          await put(u.url, blob, type, (p) => patch(key, { progress: p }));
          lastErr = null;
          break;
        } catch (e) {
          lastErr = e;
          await sleep(1000 * 3 ** attempt);
        }
      }
      if (lastErr) {
        await fetch(`/api/e/${o.slug}/uploads/${u.id}?action=cancel`, { method: "POST" }).catch(() => {});
        setRemaining((r) => r + 1);
        throw new StopError("Upload failed. Check your connection and try again.");
      }
      for (let attempt = 0; attempt < 3; attempt++) {
        const done = await fetch(`/api/e/${o.slug}/uploads/${u.id}`, { method: "POST" }).catch(() => null);
        if (done?.ok) break;
        await sleep(1500);
      }
      patch(key, { status: "done", progress: 1 });
      o.onUploaded();
    },
    [patch],
  );

  const pump = useCallback(() => {
    while (active.current < PARALLEL && queue.current.length && !stopped.current) {
      const key = queue.current.shift()!;
      active.current++;
      run(key)
        .catch((e: unknown) => {
          const err = e instanceof StopError ? e : new StopError("Upload failed. Please try again.");
          patch(key, { status: "error", error: err.message });
          if (err.stopAll) {
            stopped.current = true;
            const left = new Set(queue.current);
            queue.current = [];
            setNotice(err.message);
            setItems((l) => l.map((i) => (left.has(i.key) ? { ...i, status: "error", error: "Not uploaded" } : i)));
          }
          if (err.needsJoin) optsRef.current.onNeedJoin();
        })
        .finally(() => {
          active.current--;
          pumpRef.current();
        });
    }
  }, [patch, run]);
  useEffect(() => {
    pumpRef.current = pump;
  }, [pump]);

  const add = useCallback(
    (picked: FileList | File[]) => {
      stopped.current = false;
      setNotice(null);
      const all = Array.from(picked).filter(looksLikeImage);
      const skippedType = picked.length - all.length;
      const inFlight = queue.current.length + items.filter((i) => i.status === "preparing").length;
      const room = Math.max(0, remaining - inFlight);
      const take = all.slice(0, room);
      const msgs: string[] = [];
      if (skippedType) msgs.push(`${skippedType} file(s) skipped: only photos can be uploaded.`);
      if (all.length > take.length) msgs.push(room === 0 ? "You've reached your photo limit." : `Only ${room} more photo(s) allowed, so the first ${room} were added.`);
      if (msgs.length) setNotice(msgs.join(" "));
      const added: Item[] = take.map((f) => {
        const key = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        files.current.set(key, f);
        return { key, name: f.name, preview: URL.createObjectURL(f), status: "queued", progress: 0 };
      });
      setItems((l) => [...added, ...l]);
      queue.current.push(...added.map((i) => i.key));
      pump();
    },
    [items, remaining, pump],
  );

  const busy = items.some((i) => i.status === "queued" || i.status === "preparing" || i.status === "uploading");

  // Keep the screen awake and warn before leaving while uploads run.
  useEffect(() => {
    if (!busy) return;
    let lock: { release(): Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request(t: "screen"): Promise<{ release(): Promise<void> }> } };
    nav.wakeLock?.request("screen").then((l) => (lock = l)).catch(() => {});
    const warn = (ev: BeforeUnloadEvent) => ev.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => {
      window.removeEventListener("beforeunload", warn);
      lock?.release().catch(() => {});
    };
  }, [busy]);

  const clearDone = useCallback(() => {
    setItems((l) => {
      for (const i of l) if (i.status === "done" || i.status === "error") URL.revokeObjectURL(i.preview);
      return l.filter((i) => i.status !== "done" && i.status !== "error");
    });
  }, []);

  return { items, add, busy, notice, remaining, clearDone };
}
