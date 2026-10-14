"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GalleryPhoto } from "@/lib/photos";

// Paged gallery feed with filters (order / one guest's folder / one mission)
// and polling for new photos while the newest-first view is open.

export type GalleryFilter = { order: "new" | "old" | "top"; guest: string | null; mission: string | null; tag?: string | null };

function qs(f: GalleryFilter, extra: Record<string, string> = {}) {
  const u = new URLSearchParams({ order: f.order, ...extra });
  if (f.guest) u.set("guest", f.guest);
  if (f.mission) u.set("mission", f.mission);
  if (f.tag) u.set("tag", f.tag);
  return u;
}

export function useGallery(slug: string, filter: GalleryFilter, initial?: { photos: GalleryPhoto[]; next: string | null }) {
  const [photos, setPhotos] = useState<GalleryPhoto[]>(initial?.photos ?? []);
  const [next, setNext] = useState<string | null>(initial?.next ?? null);
  const [loading, setLoading] = useState(!initial);
  const latest = useRef<string | null>(initial?.photos[0]?.at ?? null);
  const key = `${filter.order}|${filter.guest ?? ""}|${filter.mission ?? ""}|${filter.tag ?? ""}`;
  const keyRef = useRef(key);
  const first = useRef(!!initial);

  const load = useCallback(
    async (cursor: string | null, replace: boolean) => {
      const myKey = keyRef.current;
      setLoading(true);
      try {
        const u = qs(filter);
        if (cursor) u.set("cursor", cursor);
        const r = await fetch(`/api/e/${slug}/photos?${u}`);
        if (!r.ok || myKey !== keyRef.current) return;
        const b = (await r.json()) as { photos: GalleryPhoto[]; next: string | null };
        setPhotos((prev) => (replace ? b.photos : [...prev, ...b.photos.filter((x) => !prev.some((y) => y.id === x.id))]));
        setNext(b.next);
        if (replace && filter.order === "new") latest.current = b.photos[0]?.at ?? null;
      } finally {
        if (myKey === keyRef.current) setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [slug, key],
  );

  // Reload when the filter changes (skip the very first render when the server sent page 1).
  useEffect(() => {
    keyRef.current = key;
    if (first.current) {
      first.current = false;
      return;
    }
    load(null, true);
  }, [key, load]);

  const poll = useCallback(async () => {
    if (document.hidden || filter.order !== "new") return;
    const u = qs(filter, { limit: "100" });
    if (latest.current) u.set("since", latest.current);
    const r = await fetch(`/api/e/${slug}/photos?${u}`).catch(() => null);
    if (!r?.ok) return;
    const b = (await r.json()) as { photos: GalleryPhoto[] };
    if (!b.photos.length) return;
    latest.current = b.photos[0].at;
    setPhotos((prev) => [...b.photos.filter((x) => !prev.some((y) => y.id === x.id)), ...prev]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, key]);

  useEffect(() => {
    const t = setInterval(poll, 15_000);
    const vis = () => !document.hidden && poll();
    document.addEventListener("visibilitychange", vis);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", vis);
    };
  }, [poll]);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshSoon = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(poll, 3500);
  }, [poll]);

  /** Optimistic update after a heart toggle. */
  const patchPhoto = useCallback((id: string, p: Partial<GalleryPhoto>) => {
    setPhotos((list) => list.map((x) => (x.id === id ? { ...x, ...p } : x)));
  }, []);

  return {
    photos,
    next,
    loading,
    more: () => {
      if (next && !loading) load(next, false);
    },
    reload: () => load(null, true),
    refreshSoon,
    patchPhoto,
  };
}

export type Gallery = ReturnType<typeof useGallery>;
