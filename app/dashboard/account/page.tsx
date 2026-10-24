import { Mail, ShieldCheck } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { Card, Field, Input } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { one } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { deleteAccount, saveProfile } from "./actions";

export const metadata = { title: "Account" };

export default async function Account() {
  const user = await requireUser();
  const [extra, counts] = await Promise.all([
    one<{ created_at: Date; last_login_at: Date | null }>("select created_at, last_login_at from users where id = $1", [user.id]),
    one<{ events: number; paid: number; photos: number }>(
      "select count(*)::int events, count(*) filter (where paid_at is not null and purged_at is null)::int paid, coalesce(sum(photo_count), 0)::int photos from events where owner_id = $1",
      [user.id],
    ),
  ]);

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Account</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your details and how to close your account.</p>
      </div>

      <section className="flex flex-wrap items-center gap-4 rounded-3xl border border-border bg-card p-6 shadow-soft">
        <span className="grid size-16 place-items-center rounded-full bg-brand text-2xl font-extrabold uppercase text-white">{(user.name ?? user.email).charAt(0)}</span>
        <div className="min-w-0 flex-1 basis-48">
          <div className="truncate text-xl font-extrabold">{user.name ?? user.email.split("@")[0]}</div>
          <div className="flex items-center gap-1.5 truncate text-sm text-muted-foreground">
            <Mail className="size-4" aria-hidden /> {user.email}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Member since {extra ? formatDate(extra.created_at) : "—"}
            {extra?.last_login_at ? ` · last login ${formatDate(extra.last_login_at)}` : ""}
          </div>
        </div>
        <div className="grid w-full grid-cols-3 gap-2 text-center sm:w-auto">
          {[
            { n: counts?.events ?? 0, l: "events" },
            { n: counts?.paid ?? 0, l: "active" },
            { n: counts?.photos ?? 0, l: "photos" },
          ].map((x) => (
            <div key={x.l} className="rounded-2xl bg-canvas px-3 py-2">
              <div className="text-lg font-extrabold">{x.n.toLocaleString("en-MY")}</div>
              <div className="text-[11px] text-muted-foreground">{x.l}</div>
            </div>
          ))}
        </div>
      </section>

      <Card className="rounded-3xl p-6">
        <h2 className="text-lg font-bold">Your details</h2>
        <p className="mb-4 text-sm text-muted-foreground">Shown on your receipts. Your email is how you log in, so it can&apos;t be changed here.</p>
        <ActionForm action={saveProfile} submit="Save details">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="name">
              <Input id="name" name="name" maxLength={80} defaultValue={user.name ?? ""} placeholder="Aina Rahman" />
            </Field>
            <Field label="Phone (optional)" htmlFor="phone">
              <Input id="phone" name="phone" inputMode="tel" maxLength={20} defaultValue={user.phone ?? ""} placeholder="+60 12 345 6789" />
            </Field>
          </div>
        </ActionForm>
      </Card>

      <Card className="flex items-start gap-3 rounded-3xl p-6">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-ok" aria-hidden />
        <div className="text-sm">
          <div className="font-bold">No password to remember</div>
          <p className="text-muted-foreground">You log in with a one-time code sent to {user.email}. Logging out on one device doesn&apos;t affect the others.</p>
        </div>
      </Card>

      <Card className="grid gap-3 rounded-3xl border-danger/30 p-6">
        <h2 className="text-lg font-bold text-danger">Delete account</h2>
        <p className="text-sm text-muted-foreground">
          This deletes the photos, guests and wishes of all your events right away ({counts?.photos ?? 0} photos), removes unpaid drafts, and closes your account. Receipts of past payments are
          kept for accounting, without your name. <strong className="text-foreground">This can&apos;t be undone</strong> — download your albums first.
        </p>
        <ActionForm action={deleteAccount} submit="Delete my account" variant="danger">
          <Field label={`Type ${user.email} to confirm`} htmlFor="confirm">
            <Input id="confirm" name="confirm" autoComplete="off" required />
          </Field>
        </ActionForm>
      </Card>
    </div>
  );
}
