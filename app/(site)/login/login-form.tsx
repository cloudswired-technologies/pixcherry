"use client";

import { useActionState } from "react";
import { Button, Field, Input, Notice } from "@/components/ui";
import { Turnstile } from "@/components/turnstile";
import { checkCode, requestCode, type LoginState } from "./actions";

export function LoginForm({ next, siteKey }: { next: string; siteKey: string | null }) {
  const [sent, send, sending] = useActionState(requestCode, { step: "email", next } as LoginState);
  const [checked, check, checking] = useActionState(checkCode, { step: "code" } as LoginState);
  const state = checked.error && checked.step === "email" ? checked : sent;

  if (state.step === "code" && state.email) {
    return (
      <form action={check} className="grid gap-4">
        <p className="text-sm text-muted-foreground">
          We sent a 6-digit code to <strong className="text-foreground">{state.email}</strong>.
        </p>
        <input type="hidden" name="email" value={state.email} />
        <input type="hidden" name="next" value={next} />
        <Field label="Login code" htmlFor="code">
          <Input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required autoFocus placeholder="123456" className="text-center text-xl tracking-[0.4em]" />
        </Field>
        {checked.error ? <Notice tone="danger">{checked.error}</Notice> : null}
        <Button type="submit" size="lg" disabled={checking}>
          {checking ? "Checking…" : "Log in"}
        </Button>
        <button type="button" className="text-sm text-muted-foreground underline" onClick={() => location.reload()}>
          Use a different email
        </button>
      </form>
    );
  }

  return (
    <form action={send} className="grid gap-4">
      <input type="hidden" name="next" value={next} />
      <Field label="Email" htmlFor="email" help="We'll email you a login code. No password needed.">
        <Input id="email" name="email" type="email" autoComplete="email" required autoFocus defaultValue={state.email} placeholder="you@example.com" />
      </Field>
      {siteKey ? <Turnstile siteKey={siteKey} /> : null}
      {state.error ? <Notice tone="danger">{state.error}</Notice> : null}
      <Button type="submit" size="lg" disabled={sending}>
        {sending ? "Sending…" : "Email me a code"}
      </Button>
    </form>
  );
}
