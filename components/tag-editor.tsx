"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";

// Hashtag chips for the organiser: tap a chip's × to remove it, type and press
// Enter (or comma/space) to add, or tap an idea below. Submits as one field.

const IDEAS = ["ceremony", "reception", "family", "friends", "food", "selfie", "dancefloor", "details", "kids", "outfits", "funny", "candid", "speech", "cake", "bestday"];
const clean = (s: string) => s.trim().replace(/^#+/, "").toLowerCase().replace(/[^a-z0-9_]+/g, "").slice(0, 24);

export function TagEditor({ name, defaultValue, max = 12 }: { name: string; defaultValue: string[]; max?: number }) {
  const [tags, setTags] = useState<string[]>(defaultValue);
  const [draft, setDraft] = useState("");
  const add = (raw: string) => {
    const t = clean(raw);
    if (t.length >= 2 && !tags.includes(t) && tags.length < max) setTags([...tags, t]);
    setDraft("");
  };
  const ideas = IDEAS.filter((i) => !tags.includes(i)).slice(0, 8);
  return (
    <div className="grid gap-3 rounded-2xl border border-input bg-card p-3">
      <input type="hidden" name={name} value={tags.map((t) => `#${t}`).join(" ")} />
      <div className="flex flex-wrap gap-2">
        {tags.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-full bg-brand-soft py-1 pl-3 pr-1 text-sm font-semibold text-brand-strong">
            #{t}
            <button type="button" onClick={() => setTags(tags.filter((x) => x !== t))} className="grid size-6 place-items-center rounded-full hover:bg-white/70" aria-label={`Remove #${t}`}>
              <X className="size-3.5" aria-hidden />
            </button>
          </span>
        ))}
        {tags.length < max ? (
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === "," || e.key === " ") {
                e.preventDefault();
                add(draft);
              } else if (e.key === "Backspace" && !draft && tags.length) setTags(tags.slice(0, -1));
            }}
            onBlur={() => draft && add(draft)}
            placeholder={tags.length ? "Add another…" : "Type a hashtag and press Enter"}
            aria-label="Add a hashtag"
            className="h-8 min-w-36 flex-1 bg-transparent px-1 text-sm outline-none"
          />
        ) : null}
      </div>
      {ideas.length && tags.length < max ? (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-border pt-2.5">
          <span className="text-xs font-semibold text-muted-foreground">Ideas:</span>
          {ideas.map((i) => (
            <button key={i} type="button" onClick={() => add(i)} className="inline-flex items-center gap-0.5 rounded-full border border-dashed border-border px-2.5 py-0.5 text-xs font-semibold text-muted-foreground hover:border-brand hover:text-brand">
              <Plus className="size-3" aria-hidden /> {i}
            </button>
          ))}
        </div>
      ) : null}
      <p className="text-xs text-muted-foreground">
        {tags.length}/{max} · each one becomes an album in the guests&apos; Highlights. Guests can also add their own.
      </p>
    </div>
  );
}
