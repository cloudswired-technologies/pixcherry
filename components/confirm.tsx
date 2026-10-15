"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { cn } from "@/components/ui";

// A button that asks first: "Remove Yaya? Their 23 photos go too." Wraps a
// server action in a form; the dialog's confirm button submits it.

function Submit({ label, danger }: { label: string; danger: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn("inline-flex h-10 items-center justify-center gap-2 rounded-full px-5 text-sm font-bold text-white disabled:opacity-60", danger ? "bg-danger hover:bg-danger/90" : "bg-ink hover:bg-ink/85")}
    >
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
      {label}
    </button>
  );
}

export function Confirm({
  action,
  title,
  message,
  confirm,
  danger = true,
  className,
  children,
  label,
}: {
  action: () => Promise<void> | void;
  title: string;
  message?: React.ReactNode;
  confirm: string;
  danger?: boolean;
  className?: string;
  /** Contents of the trigger button. */
  children: React.ReactNode;
  /** Accessible name of the trigger when it's only an icon. */
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    cancel.current?.focus();
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open]);
  return (
    <form
      action={async () => {
        await action();
        setOpen(false);
      }}
    >
      <button type="button" onClick={() => setOpen(true)} className={className} aria-label={label}>
        {children}
      </button>
      {open ? (
        <div className="fixed inset-0 z-[90] grid place-items-end bg-ink/50 p-3 backdrop-blur-sm sm:place-items-center" onClick={() => setOpen(false)}>
          <div role="alertdialog" aria-modal="true" aria-label={title} className="w-full max-w-sm rounded-3xl bg-card p-5 shadow-lift [animation:pc-rise_0.2s_ease]" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold">{title}</h2>
            {message ? <div className="mt-1.5 text-sm text-muted-foreground">{message}</div> : null}
            <div className="mt-5 flex justify-end gap-2">
              <button ref={cancel} type="button" onClick={() => setOpen(false)} className="inline-flex h-10 items-center rounded-full border border-border px-5 text-sm font-semibold hover:bg-muted">
                Cancel
              </button>
              <Submit label={confirm} danger={danger} />
            </div>
          </div>
        </div>
      ) : null}
    </form>
  );
}
