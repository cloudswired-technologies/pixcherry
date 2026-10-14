"use client";

import { useActionState, type ReactNode } from "react";
import { Button, Notice, cn, type BtnVariant } from "@/components/ui";

type State = { error?: string; ok?: string };

/** Form bound to a server action returning {error?, ok?}; shows the result under the fields. */
export function ActionForm({
  action,
  children,
  submit,
  pending = "Saving…",
  variant = "primary",
  className,
  encType,
  fullWidth,
}: {
  action: (s: State, fd: FormData) => Promise<State>;
  children?: ReactNode;
  submit: string;
  pending?: string;
  variant?: BtnVariant;
  className?: string;
  encType?: "multipart/form-data";
  fullWidth?: boolean;
}) {
  const [state, run, busy] = useActionState(action, {});
  return (
    <form action={run} className={cn("grid gap-4", className)} encType={encType}>
      {children}
      {state.error ? <Notice tone="danger">{state.error}</Notice> : null}
      {state.ok ? <Notice tone="ok">{state.ok}</Notice> : null}
      <div>
        <Button type="submit" variant={variant} size="lg" disabled={busy} className={fullWidth ? "w-full" : undefined}>
          {busy ? pending : submit}
        </Button>
      </div>
    </form>
  );
}
