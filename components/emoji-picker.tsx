"use client";

import { useEffect, useRef, useState } from "react";

// A small emoji picker for missions: tap the button, pick from a grid. The
// choice is submitted as a hidden field (no typing emoji on a laptop).

const EMOJI = [
  "📸", "🤳", "🎯", "💍", "💐", "👰", "🤵", "💃", "🕺", "🎉",
  "🥂", "🍰", "🎂", "🍛", "🍽️", "☕", "👨‍👩‍👧", "👶", "👵", "👴",
  "🤝", "🤗", "😂", "😍", "🥹", "😎", "🙌", "❤️", "✨", "🌸",
  "🎈", "🎁", "🎤", "🎶", "🏆", "🌅", "🌙", "🕌", "⛪", "🏖️",
  "🚗", "👗", "👠", "💄", "🐱", "🌿", "🎨", "📷", "⭐", "🔥",
];

export function EmojiPicker({ name, defaultValue = "📸" }: { name: string; defaultValue?: string }) {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  return (
    <div ref={box} className="relative">
      <input type="hidden" name={name} value={value} />
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="grid h-11 w-full place-items-center rounded-xl border border-input bg-card text-2xl hover:border-ink"
        aria-label={`Mission emoji: ${value}. Change`}
        aria-expanded={open}
      >
        {value}
      </button>
      {open ? (
        <div className="absolute left-0 top-12 z-30 grid w-72 grid-cols-8 gap-1 rounded-2xl border border-border bg-card p-2 shadow-lift" role="listbox" aria-label="Choose an emoji">
          {EMOJI.map((em) => (
            <button
              key={em}
              type="button"
              role="option"
              aria-selected={em === value}
              onClick={() => {
                setValue(em);
                setOpen(false);
              }}
              className={`grid size-8 place-items-center rounded-lg text-xl hover:bg-muted ${em === value ? "bg-brand-soft" : ""}`}
            >
              {em}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
