"use client";

import { useActionState, useState } from "react";
import { Trash2 } from "lucide-react";
import { deleteEventNow, type FormState } from "../../actions";

/** Danger zone: type the event name, then delete. */
export function DeleteEvent({ id, name, paid }: { id: string; name: string; paid: boolean }) {
  const [typed, setTyped] = useState("");
  const [state, run, busy] = useActionState(deleteEventNow.bind(null, id), {} as FormState);
  const ok = typed.trim().toLowerCase() === name.trim().toLowerCase();
  return (
    <form action={run} className="grid gap-3">
      <p className="text-sm text-muted-foreground">
        {paid
          ? "Deletes every photo, wish and heart in this album right now. Guests will see that the album has closed. Your payment receipts are kept. This can't be undone."
          : "Deletes this unpaid draft."}
      </p>
      <label className="grid gap-1.5 text-sm">
        <span>
          Type <strong className="select-all">{name}</strong> to confirm
        </span>
        <input name="confirm" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" className="h-11 rounded-xl border border-input bg-white px-3 outline-none focus:border-danger" />
      </label>
      {state.error ? <p className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p> : null}
      <button disabled={!ok || busy} className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-danger px-5 text-sm font-semibold text-white disabled:opacity-40">
        <Trash2 className="size-4" aria-hidden /> {busy ? "Deleting…" : paid ? "Delete event and all photos" : "Delete draft"}
      </button>
    </form>
  );
}
