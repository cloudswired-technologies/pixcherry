"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { btn } from "@/components/ui";

export function CopyButton({ text, label = "Copy link" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={btn("outline", "md")}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1800);
        } catch {
          prompt("Copy this link", text);
        }
      }}
    >
      {done ? <Check aria-hidden /> : <Copy aria-hidden />}
      {done ? "Copied" : label}
    </button>
  );
}
