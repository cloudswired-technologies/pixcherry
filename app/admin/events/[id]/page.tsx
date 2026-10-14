import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { PhaseBadge } from "@/components/event-bits";
import { Card, Field, Input, LinkButton, Notice, PageHeader, Select, Stat } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { one, q } from "@/lib/db";
import { getEventById } from "@/lib/events";
import { formatBytes, formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { eventPhase } from "@/lib/limits";
import { FEATURES, LIMITS, normaliseLimits } from "@/lib/plan-schema";
import { listPlans, listPresets } from "@/lib/plans";
import { activateEvent, saveOverrides } from "../../actions";

export const metadata = { title: "Event" };

export default async function AdminEvent({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const e = await getEventById(id);
  if (!e) notFound();
  const [owner, presets, plans, purchases, status] = await Promise.all([
    one<{ email: string; name: string | null }>("select email, name from users where id = $1", [e.owner_id]),
    listPresets(),
    listPlans(false),
    q<{ id: string; description: string; amount_cents: number; status: string; receipt_no: string | null; created_at: Date }>(
      "select id, description, amount_cents, status, receipt_no, created_at from purchases where event_id = $1 order by created_at desc",
      [e.id],
    ),
    q<{ status: string; n: number }>("select status, count(*)::int as n from photos where event_id = $1 group by status", [e.id]),
  ]);
  const base = normaliseLimits(e.plan_snapshot?.limits);
  const ov = e.overrides ?? {};
  const presetMatch = ov.quality ? presets.find((p) => p.name === ov.quality!.name && p.max_px === ov.quality!.max_px) : null;

  return (
    <div className="grid gap-6">
      <Link href="/admin/events" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Events
      </Link>
      <PageHeader
        title={e.name}
        sub={`${owner?.email} · ${formatDateTime(e.starts_at)} – ${formatDateTime(e.ends_at)}`}
        actions={
          <>
            <PhaseBadge phase={eventPhase(e)} />
            <LinkButton href={`/dashboard/events/${e.id}`} variant="outline" size="sm">
              Open as organiser
            </LinkButton>
          </>
        }
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Photos" value={e.photo_count} hint={status.map((s) => `${s.n} ${s.status}`).join(" · ")} />
        <Stat label="Guests" value={e.guest_count} />
        <Stat label="Storage" value={formatBytes(Number(e.bytes_used))} />
        <Stat label="Deletion" value={e.purged_at ? "Deleted" : e.deletion_at ? formatDate(e.deletion_at) : "—"} hint={e.warned_at ? `Warned ${formatDate(e.warned_at)}` : undefined} />
      </div>

      {!e.paid_at ? (
        <Card className="grid gap-3">
          <h2 className="font-bold">Activate without payment</h2>
          <p className="text-sm text-muted-foreground">For giveaways or payments received outside CHIP. Creates an RM0 purchase.</p>
          <ActionForm action={activateEvent.bind(null, e.id)} submit="Activate">
            <Select name="plan_id" required>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({formatMoney(p.price_cents)})
                </option>
              ))}
            </Select>
          </ActionForm>
        </Card>
      ) : (
        <Card className="grid gap-4">
          <div>
            <h2 className="font-bold">Overrides for this event</h2>
            <p className="text-sm text-muted-foreground">
              Package as paid: <strong>{e.plan_snapshot?.name}</strong>. Leave a field empty to use the package value (+ add-ons). Values here replace everything else.
            </p>
          </div>
          <Notice>
            Effective now: {LIMITS.map((l) => `${l.label.toLowerCase()} ${e.cfg.limits[l.key]}`).join(" · ")} · quality {e.cfg.quality.name}
          </Notice>
          <ActionForm action={saveOverrides.bind(null, e.id)} submit="Save overrides">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {LIMITS.map((l) => (
                <Field key={l.key} label={l.label} help={`Package: ${base[l.key]}${e.addon_totals?.[l.key as keyof typeof e.addon_totals] ? ` + ${e.addon_totals[l.key as keyof typeof e.addon_totals]} add-on` : ""} ${l.unit}`}>
                  <Input name={`limit_${l.key}`} type="number" min={l.min} defaultValue={ov.limits?.[l.key] ?? ""} />
                </Field>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {FEATURES.map((f) => (
                <Field key={f.key} label={f.label}>
                  <Select name={`feature_${f.key}`} defaultValue={ov.features?.[f.key] === undefined ? "" : ov.features[f.key] ? "on" : "off"}>
                    <option value="">Package ({e.plan_snapshot?.features?.[f.key] ? "on" : "off"})</option>
                    <option value="on">On</option>
                    <option value="off">Off</option>
                  </Select>
                </Field>
              ))}
              <Field label="Photo quality">
                <Select name="quality_preset_id" defaultValue={presetMatch?.id ?? ""}>
                  <option value="">Package ({e.plan_snapshot?.quality.name})</option>
                  {presets.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Admin note" help="Why the override was given (visible to admins only).">
              <Input name="note" maxLength={500} defaultValue={ov.note ?? ""} />
            </Field>
          </ActionForm>
        </Card>
      )}

      <Card className="grid gap-3">
        <h2 className="font-bold">Purchases</h2>
        <ul className="divide-y divide-border text-sm">
          {purchases.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>
                {p.description} <span className="text-xs text-muted-foreground">· {formatDateTime(p.created_at)}</span>
              </span>
              <span className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">{p.status}</span>
                {formatMoney(p.amount_cents)}
                {p.receipt_no ? (
                  <Link href={`/dashboard/receipts/${p.id}`} className="text-xs underline">
                    {p.receipt_no}
                  </Link>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
