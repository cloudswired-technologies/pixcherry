"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { slugProblem, slugify } from "@/lib/slug";

/**
 * Event link input: "app.pixcherry.com/" + the slug, checked live.
 * With `followName`, it fills itself from the #name field until the organiser edits it.
 */
export function SlugField({ prefix, defaultValue = "", eventId, followName }: { prefix: string; defaultValue?: string; eventId?: string; followName?: boolean }) {
  const [value, setValue] = useState(defaultValue);
  const [check, setCheck] = useState<{ s: string; ok: boolean; error?: string } | null>(null);
  const touched = useRef(!!defaultValue);
  const [auto, setAuto] = useState(!defaultValue);

  useEffect(() => {
    if (!followName) return;
    const el = document.getElementById("name") as HTMLInputElement | null;
    if (!el) return;
    const sync = () => !touched.current && setValue(slugify(el.value).slice(0, 34).replace(/-+$/g, ""));
    el.addEventListener("input", sync);
    return () => el.removeEventListener("input", sync);
  }, [followName]);

  useEffect(() => {
    if (!value || value === defaultValue) return;
    const local = slugProblem(value);
    const t = setTimeout(async () => {
      if (local) return setCheck({ s: value, ok: false, error: local });
      const r = await fetch(`/api/slug?s=${encodeURIComponent(value)}${eventId ? `&event=${eventId}` : ""}`).catch(() => null);
      const b = r?.ok ? ((await r.json()) as { ok: boolean; error?: string }) : null;
      if (b) setCheck({ s: value, ...b });
    }, 350);
    return () => clearTimeout(t);
  }, [value, defaultValue, eventId]);

  const state = !value || value === defaultValue ? null : check?.s === value ? check : "checking";
  return (
    <div className="grid gap-1.5">
      <div className="flex h-11 min-w-0 items-center overflow-hidden rounded-xl border border-input bg-card focus-within:border-ink">
        <span className="shrink-0 select-none pl-3 text-sm text-muted-foreground">{prefix}</span>
        <input
          id="slug"
          name="slug"
          value={value}
          onChange={(e) => {
            touched.current = true;
            setAuto(false);
            setValue(e.target.value.toLowerCase().replace(/[\s_]+/g, "-").replace(/[^a-z0-9-]/g, "").slice(0, 40));
          }}
          placeholder="aina-hakim"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="h-full min-w-0 flex-1 bg-transparent pr-2 text-base font-semibold outline-none"
        />
        <span className="grid w-9 shrink-0 place-items-center">
          {state === "checking" ? (
            <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />
          ) : state?.ok ? (
            <Check className="size-4 text-ok" aria-label="Available" />
          ) : state ? (
            <X className="size-4 text-danger" aria-hidden />
          ) : null}
        </span>
      </div>
      {/* Filled in from the name: the server adds -2, -3… itself if it's taken. */}
      {auto ? <input type="hidden" name="slug_auto" value="1" /> : null}
      {state && state !== "checking" && !state.ok ? (
        auto ? (
          <p className="text-xs text-muted-foreground">Taken — we&apos;ll add a number to make it yours, or type your own.</p>
        ) : (
          <p className="text-xs font-semibold text-danger">{state.error}</p>
        )
      ) : null}
    </div>
  );
}
