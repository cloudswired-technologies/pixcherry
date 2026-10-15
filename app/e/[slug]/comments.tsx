"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, X } from "lucide-react";
import { initial } from "./panels";

// Instagram-style comments under a photo in the viewer: a two-line preview
// ("View all 4 comments") and a sheet with the full thread and a reply box.

export type CommentItem = { id: string; name: string | null; body: string; at: string; mine: boolean };

export function ago(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

/** Comments of one photo. Loads only when the photo has any (or the sheet is open). */
export function useComments(slug: string, photoId: string, load: boolean) {
  const [list, setList] = useState<{ photo: string; items: CommentItem[] } | null>(null);
  useEffect(() => {
    if (!load) return;
    let live = true;
    const t = setTimeout(() => {
      fetch(`/api/e/${slug}/photos/${photoId}/comments`)
        .then((r) => (r.ok ? r.json() : { comments: [] }))
        .then((b: { comments: CommentItem[] }) => live && setList({ photo: photoId, items: b.comments }))
        .catch(() => {});
    }, 150); // swiping fast through photos shouldn't fire a request per photo
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [slug, photoId, load]);
  const items = list?.photo === photoId ? list.items : null;
  const set = useCallback((fn: (l: CommentItem[]) => CommentItem[]) => setList((x) => ({ photo: photoId, items: fn(x?.photo === photoId ? x.items : []) })), [photoId]);
  return { items, set };
}

export function CommentPreview({ items, count, onOpen }: { items: CommentItem[] | null; count: number; onOpen: () => void }) {
  if (!count) return null;
  const last = items?.slice(-2) ?? [];
  return (
    <button type="button" onClick={onOpen} className="grid gap-0.5 text-left text-sm">
      {count > 2 || !items ? <span className="text-white/60">View all {count} comment{count === 1 ? "" : "s"}</span> : null}
      {last.map((c) => (
        <span key={c.id} className="line-clamp-1">
          <strong className="font-semibold">{c.name ?? "Guest"}</strong> <span className="text-white/90">{c.body}</span>
        </span>
      ))}
    </button>
  );
}

export function CommentsSheet({
  slug,
  photoId,
  items,
  set,
  onClose,
  canWrite,
  joined,
  myName,
  onNeedJoin,
  onCount,
}: {
  slug: string;
  photoId: string;
  items: CommentItem[] | null;
  set: (fn: (l: CommentItem[]) => CommentItem[]) => void;
  onClose: () => void;
  canWrite: boolean;
  joined: boolean;
  myName: string | null;
  onNeedJoin: () => void;
  onCount: (n: number) => void;
}) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [items?.length]);

  const post = async () => {
    const body = draft.trim();
    if (!body || busy) return;
    if (!joined) return onNeedJoin();
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/e/${slug}/photos/${photoId}/comments`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ body }) });
      const b = (await r.json().catch(() => ({}))) as { comment?: CommentItem; count?: number; error?: string; code?: string };
      if (r.status === 401 && b.code === "join") return onNeedJoin();
      if (!r.ok || !b.comment) return setError(b.error ?? "Couldn't post. Try again.");
      set((l) => [...l, b.comment!]);
      onCount(b.count ?? 0);
      setDraft("");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    const r = await fetch(`/api/e/${slug}/photos/${photoId}/comments?c=${id}`, { method: "DELETE" }).catch(() => null);
    if (!r?.ok) return;
    const b = (await r.json()) as { count: number };
    set((l) => l.filter((c) => c.id !== id));
    onCount(b.count);
  };

  return (
    <div className="absolute inset-0 z-20 flex flex-col justify-end bg-black/45" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Comments"
        className="flex max-h-[78%] flex-col rounded-t-[1.75rem] bg-white text-ink [animation:pc-rise_0.25s_ease]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative border-b border-border px-4 py-3 text-center">
          <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-muted" />
          <h2 className="font-bold">Comments</h2>
          <button type="button" onClick={onClose} className="absolute right-3 top-4 grid size-8 place-items-center rounded-full bg-muted" aria-label="Close comments">
            <X className="size-4" aria-hidden />
          </button>
        </div>
        <div ref={list} className="min-h-32 flex-1 overflow-y-auto px-4 py-3">
          {!items ? (
            <Loader2 className="mx-auto mt-6 size-6 animate-spin text-muted-foreground" aria-label="Loading" />
          ) : !items.length ? (
            <div className="py-8 text-center">
              <div className="text-3xl">💬</div>
              <p className="mt-1 font-semibold">No comments yet</p>
              <p className="text-sm text-muted-foreground">Say something nice about this photo.</p>
            </div>
          ) : (
            <ul className="grid gap-4">
              {items.map((c) => (
                <li key={c.id} className="flex gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand text-sm font-bold text-white">{initial(c.name)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="whitespace-pre-line break-words text-sm">
                      <strong className="font-semibold">{c.name ?? "Guest"}</strong> {c.body}
                    </p>
                    <div className="mt-0.5 flex gap-3 text-xs text-muted-foreground">
                      <span>{ago(c.at)}</span>
                      {c.mine ? (
                        <button type="button" onClick={() => remove(c.id)} className="font-semibold">
                          Delete
                        </button>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        {canWrite ? (
          <div className="border-t border-border px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2.5">
            {error ? <p className="mb-2 rounded-xl bg-danger-soft px-3 py-1.5 text-xs text-danger">{error}</p> : null}
            <div className="flex items-center gap-2">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-ink text-sm font-bold text-white">{initial(myName)}</span>
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value.slice(0, 300))}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), post())}
                placeholder={joined ? "Add a comment…" : "Join the album to comment…"}
                aria-label="Add a comment"
                enterKeyHint="send"
                className="h-10 min-w-0 flex-1 rounded-full bg-muted px-4 text-sm outline-none"
              />
              <button type="button" onClick={post} disabled={!draft.trim() || busy} className="px-1 text-sm font-bold text-brand disabled:opacity-40">
                {busy ? <Loader2 className="size-4 animate-spin" aria-label="Posting" /> : "Post"}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
