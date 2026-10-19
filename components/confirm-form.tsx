"use client";

import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button, Notice, cn, type BtnVariant } from "@/components/ui";

// A form with fields (a reason, an amount…) whose submit asks first, like <Confirm>:
// the trigger checks the fields, opens a dialog, and the dialog's button submits.
// Shows the action's {error, ok} under the fields.

type State = { error?: string; ok?: string };

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

export function ConfirmForm({
  action,
  children,
  submit,
  title,
  message,
  confirm,
  danger = true,
  variant = "danger",
  className,
}: {
  action: (s: State, fd: FormData) => Promise<State>;
  children?: ReactNode;
  /** Label of the button under the fields. */
  submit: string;
  title: string;
  message?: ReactNode;
  /** Label of the dialog's button. */
  confirm: string;
  danger?: boolean;
  variant?: BtnVariant;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, run] = useActionState(async (s: State, fd: FormData) => {
    const r = await action(s, fd);
    setOpen(false);
    return r;
  }, {});
  const form = useRef<HTMLFormElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    cancel.current?.focus();
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open]);
  return (
    <form ref={form} action={run} className={cn("grid gap-4", className)}>
      {children}
      {state.error ? <Notice tone="danger">{state.error}</Notice> : null}
      {state.ok ? <Notice tone="ok">{state.ok}</Notice> : null}
      <div>
        <Button type="button" variant={variant} onClick={() => form.current?.reportValidity() && setOpen(true)}>
          {submit}
        </Button>
      </div>
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
