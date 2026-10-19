import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Camera, ExternalLink, HardDrive, Pencil, Trash2, Users } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { Kpi } from "@/components/charts";
import { PhaseBadge } from "@/components/event-bits";
import { Card, Field, Input, Notice, Select, btn, cn } from "@/components/ui";
import { DeleteEvent } from "@/app/dashboard/events/[id]/settings/delete-event";
import { requireAdmin } from "@/lib/auth";
import { one, q } from "@/lib/db";
import { coverUrl, getEventById, guestUrl } from "@/lib/events";
import { formatBytes, formatDate, formatDateTime, formatMoney, formatRange } from "@/lib/format";
import { eventPhase } from "@/lib/limits";
import { FEATURES, LIMITS, normaliseLimits } from "@/lib/plan-schema";
import { listPlans } from "@/lib/plans";
import { activateEvent, saveOverrides } from "../../actions";
import { PaymentStatus } from "../../payments/bits";

export const metadata = { title: "Event" };

export default async function AdminEvent({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const e = await getEventById(id);
  if (!e) notFound();
  const [owner, plans, purchases, status] = await Promise.all([
    one<{ email: string; name: string | null }>("select email, name from users where id = $1", [e.owner_id]),
    listPlans(false),
    q<{ id: string; description: string; amount_cents: number; refund_cents: number | null; status: string; receipt_no: string | null; created_at: Date }>(
      "select id, description, amount_cents, refund_cents, status, receipt_no, created_at from purchases where event_id = $1 order by created_at desc",
      [e.id],
    ),
    q<{ status: string; n: number }>("select status, count(*)::int as n from photos where event_id = $1 group by status", [e.id]),
  ]);
  const base = normaliseLimits(e.plan_snapshot?.limits);
  const ov = e.overrides ?? {};
  const addons = (e.addon_totals ?? {}) as Record<string, number>;
  const cover = coverUrl(e);
  const paid = purchases.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount_cents - (p.refund_cents ?? 0), 0);

  return (
    <div className="grid gap-6">
      <Link href="/admin/events" className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> All events
      </Link>

      <section className="flex flex-wrap items-center gap-4 rounded-3xl border border-border bg-card p-5 shadow-soft">
        {cover ? <img src={cover} alt="" className="size-20 rounded-2xl object-cover" /> : <span className="grid size-20 place-items-center rounded-2xl bg-brand-soft text-3xl">📸</span>}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-extrabold tracking-tight">{e.name}</h1>
            <PhaseBadge phase={eventPhase(e)} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            <Link href={`/admin/users/${e.owner_id}`} className="font-semibold text-brand hover:underline">
              {owner?.name ?? owner?.email}
            </Link>
            {owner?.name ? ` · ${owner.email}` : ""} · {formatRange(e.starts_at, e.ends_at)}
          </p>
          <p className="text-sm text-muted-foreground">
            {e.plan_snapshot?.name ?? "No package yet"} · {paid ? `${formatMoney(paid)} paid` : "nothing paid"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {e.paid_at && !e.purged_at ? (
            <a href={guestUrl(e.slug)} target="_blank" rel="noreferrer" className={btn("brand", "sm")}>
              <ExternalLink aria-hidden /> Guest page
            </a>
          ) : null}
          <Link href={`/dashboard/events/${e.id}`} className={btn("outline", "sm")}>
            Open as organiser
          </Link>
          {!e.purged_at ? (
            <Link href={`/dashboard/events/${e.id}/settings`} className={btn("outline", "sm")}>
              <Pencil aria-hidden /> Edit details
            </Link>
          ) : null}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={Camera} label="Photos" value={e.photo_count.toLocaleString("en-MY")} sub={<span className="text-xs text-muted-foreground">{status.map((s) => `${s.n} ${s.status}`).join(" · ") || "none yet"}</span>} />
        <Kpi icon={Users} label="Guests" value={`${e.guest_count} / ${e.cfg.limits.max_guests}`} tone="amber" />
        <Kpi icon={HardDrive} label="Storage" value={formatBytes(Number(e.bytes_used))} tone="ink" />
        <Kpi
          icon={Trash2}
          label="Photos deleted on"
          value={e.purged_at ? "Deleted" : e.deletion_at ? formatDate(e.deletion_at) : "—"}
          sub={e.warned_at ? <span className="text-xs text-muted-foreground">Organiser warned {formatDate(e.warned_at)}</span> : undefined}
          tone="ok"
        />
      </section>

      {!e.paid_at ? (
        <Card className="grid gap-3 rounded-3xl p-6">
          <h2 className="text-lg font-bold">Activate without payment</h2>
          <p className="text-sm text-muted-foreground">For giveaways or payments received outside CHIP. Records an RM0 purchase with the chosen package.</p>
          <ActionForm action={activateEvent.bind(null, e.id)} submit="Activate event">
            <Select name="plan_id" required>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({formatMoney(p.price_cents)})
                </option>
              ))}
            </Select>
          </ActionForm>
        </Card>
      ) : !e.purged_at ? (
        <Card className="grid gap-5 rounded-3xl p-6">
          <div>
            <h2 className="text-lg font-bold">Adjust this event</h2>
            <p className="text-sm text-muted-foreground">
              Give this one event more than its <strong>{e.plan_snapshot?.name}</strong> package — e.g. extra guests as a goodwill gesture, or a feature switched on. Leave a box empty to keep
              the package amount. Nothing here changes the package for anyone else.
            </p>
          </div>
          <ActionForm action={saveOverrides.bind(null, e.id)} submit="Save changes for this event">
            <div className="overflow-hidden rounded-2xl border border-border">
              <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3 bg-canvas/60 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <span>Limit</span>
                <span>Package</span>
                <span>This event</span>
              </div>
              <div className="divide-y divide-border">
                {LIMITS.filter((l) => !l.derived).map((l) => {
                  const pkg = base[l.key] + (addons[l.key] ?? 0);
                  const custom = ov.limits?.[l.key];
                  return (
                    <div key={l.key} className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-3 px-4 py-3">
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">{l.label}</span>
                        <span className="block text-xs text-muted-foreground">{l.unit}</span>
                      </span>
                      <span className="text-sm">
                        {pkg.toLocaleString("en-MY")}
                        {addons[l.key] ? <span className="block text-[11px] text-muted-foreground">incl. +{addons[l.key]} add-on</span> : null}
                      </span>
                      <Input name={`limit_${l.key}`} type="number" min={l.min} placeholder={String(pkg)} defaultValue={custom ?? ""} className={cn("h-10", custom !== undefined && "border-brand bg-brand-soft/40 font-semibold")} aria-label={`${l.label} for this event`} />
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-border">
              <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,2fr)] gap-3 bg-canvas/60 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <span>Feature</span>
                <span>For this event</span>
              </div>
              <div className="divide-y divide-border">
                {FEATURES.map((f) => {
                  const inPackage = !!e.plan_snapshot?.features?.[f.key];
                  const cur = ov.features?.[f.key] === undefined ? "" : ov.features[f.key] ? "on" : "off";
                  return (
                    <fieldset key={f.key} className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,2fr)] items-center gap-3 px-4 py-3">
                      <legend className="sr-only">{f.label}</legend>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">{f.label}</span>
                        <span className="block text-xs text-muted-foreground">Package: {inPackage ? "on" : "off"}</span>
                      </span>
                      <span className="flex flex-wrap gap-1.5">
                        {[
                          { v: "", label: `As package (${inPackage ? "on" : "off"})` },
                          { v: "on", label: "On" },
                          { v: "off", label: "Off" },
                        ].map((o) => (
                          <label key={o.v} className="cursor-pointer">
                            <input type="radio" name={`feature_${f.key}`} value={o.v} defaultChecked={cur === o.v} className="peer sr-only" />
                            <span className="inline-flex h-8 items-center rounded-full border border-border px-3 text-xs font-semibold peer-checked:border-brand peer-checked:bg-brand peer-checked:text-white">
                              {o.label}
                            </span>
                          </label>
                        ))}
                      </span>
                    </fieldset>
                  );
                })}
              </div>
            </div>

            <Field label="Why (admins only)" help="So the team knows later why this event got more, e.g. “Gift: venue partner”.">
              <Input name="note" maxLength={500} defaultValue={ov.note ?? ""} />
            </Field>
          </ActionForm>
        </Card>
      ) : (
        <Notice tone="danger">Photos for this event were deleted on {formatDate(e.purged_at)}.</Notice>
      )}

      <Card className="grid gap-3 rounded-3xl p-6">
        <h2 className="text-lg font-bold">Payments</h2>
        {purchases.length ? (
          <ul className="divide-y divide-border text-sm">
            {purchases.map((p) => (
              <li key={p.id}>
                <Link href={`/admin/payments/${p.id}`} className="-mx-2 flex flex-wrap items-center justify-between gap-2 rounded-xl px-2 py-2.5 hover:bg-canvas/60">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{p.description}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(p.created_at)}
                      {p.receipt_no ? ` · ${p.receipt_no}` : ""}
                    </span>
                  </span>
                  <span className="flex items-center gap-3">
                    <PaymentStatus p={p} />
                    <span className="font-semibold">{formatMoney(p.amount_cents)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No payments.</p>
        )}
      </Card>

      {!e.purged_at ? (
        <Card className="grid gap-3 rounded-3xl border-danger/30 p-6">
          <h2 className="text-lg font-bold text-danger">Delete event</h2>
          <DeleteEvent id={e.id} name={e.name} paid={!!e.paid_at} />
        </Card>
      ) : null}
    </div>
  );
}
