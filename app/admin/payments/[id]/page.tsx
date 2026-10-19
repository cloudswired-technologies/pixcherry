import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, ReceiptText, RefreshCw } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { Confirm } from "@/components/confirm";
import { ConfirmForm } from "@/components/confirm-form";
import { Card, Field, Input, Notice, btn } from "@/components/ui";
import { ACTION_LABEL, KIND_LABEL, getPayment } from "@/lib/admin-data";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime, formatMoney } from "@/lib/format";
import { recheckPayment, recordRefund, removeRefund } from "../actions";
import { PaymentStatus } from "../bits";

export const metadata = { title: "Payment" };

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.6fr)] gap-3 py-2.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words font-medium">{children}</dd>
    </div>
  );
}

export default async function AdminPayment({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const data = await getPayment(id);
  if (!data) notFound();
  const { p, callbacks, activity } = data;
  const net = p.amount_cents - (p.refund_cents ?? 0);
  const history = [
    ...callbacks.map((c) => ({ key: `c${c.id}`, at: c.created_at, title: c.ok ? "CHIP confirmed the payment" : `CHIP callback: ${c.note ?? "not paid"}`, by: "CHIP", tone: c.ok ? "bg-ok" : "bg-muted-foreground" })),
    ...activity.map((a) => ({
      key: `a${a.id}`,
      at: a.created_at,
      title: `${ACTION_LABEL[a.action] ?? a.action}${typeof a.details?.refund_cents === "number" ? ` · ${formatMoney(a.details.refund_cents)}` : ""}${typeof a.details?.status === "string" ? ` · ${a.details.status}` : ""}`,
      by: a.actor ?? "system",
      tone: a.action.startsWith("payment.refund") ? "bg-danger" : "bg-brand",
    })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return (
    <div className="grid gap-6">
      <Link href="/admin/payments" className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> All payments
      </Link>

      <section className="flex flex-wrap items-center gap-4 rounded-3xl border border-border bg-card p-5 shadow-soft">
        <span className="grid size-16 shrink-0 place-items-center rounded-3xl bg-ok-soft text-ok">
          <ReceiptText className="size-7" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-extrabold tracking-tight">{formatMoney(p.amount_cents)}</h1>
            <PaymentStatus p={p} />
          </div>
          <p className="mt-1 truncate text-sm text-muted-foreground">
            {p.description} · {p.receipt_no ?? "no receipt yet"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {p.status === "paid" ? (
            <Link href={`/dashboard/receipts/${p.id}`} className={btn("outline", "sm")}>
              <ReceiptText aria-hidden /> Receipt
            </Link>
          ) : null}
          <Link href={`/admin/events/${p.event_id}`} className={btn("outline", "sm")}>
            Event
          </Link>
          <Link href={`/admin/users/${p.user_id}`} className={btn("outline", "sm")}>
            Organiser
          </Link>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="grid content-start gap-6">
          <Card className="rounded-3xl p-6">
            <h2 className="text-lg font-bold">Details</h2>
            <dl className="mt-2 divide-y divide-border">
              <Row label="Organiser">
                <Link href={`/admin/users/${p.user_id}`} className="text-brand hover:underline">
                  {p.name ? `${p.name} · ` : ""}
                  {p.email}
                </Link>
              </Row>
              <Row label="Event">
                <Link href={`/admin/events/${p.event_id}`} className="text-brand hover:underline">
                  {p.event}
                </Link>
              </Row>
              <Row label="Item">
                {KIND_LABEL[p.kind] ?? p.kind}: {p.plan ?? p.addon ?? p.description}
              </Row>
              <Row label="Started checkout">{formatDateTime(p.created_at)}</Row>
              <Row label="Paid">{p.paid_at ? formatDateTime(p.paid_at) : "Not paid"}</Row>
              <Row label="Price">{formatMoney(p.subtotal_cents)}</Row>
              <Row label="Discount">{p.discount_cents ? `−${formatMoney(p.discount_cents)}${p.promo ? ` (code ${p.promo})` : ""}` : "None"}</Row>
              <Row label="Charged">{formatMoney(p.amount_cents)}</Row>
              {p.refund_cents ? (
                <>
                  <Row label="Refunded">
                    <span className="text-danger">−{formatMoney(p.refund_cents)}</span> on {formatDateTime(p.refunded_at!)}
                    {p.refund_note ? <span className="block text-xs font-normal text-muted-foreground">“{p.refund_note}”</span> : null}
                  </Row>
                  <Row label="Kept">{formatMoney(net)}</Row>
                </>
              ) : null}
              <Row label="CHIP purchase">
                <span className="font-mono text-xs">{p.chip_purchase_id ?? (p.amount_cents === 0 ? "None (free)" : "None")}</span>
              </Row>
              <Row label="PixCherry id">
                <span className="font-mono text-xs">{p.id}</span>
              </Row>
            </dl>
          </Card>
        </div>

        <div className="grid content-start gap-6">
          {p.status === "pending" && p.chip_purchase_id ? (
            <Card className="grid gap-3 rounded-3xl p-6">
              <h2 className="text-lg font-bold">Waiting for payment</h2>
              <p className="text-sm text-muted-foreground">
                The organiser opened the CHIP checkout but we haven&apos;t heard it was paid. If they say they paid, ask CHIP directly: a paid checkout is activated and the receipt is
                emailed.
              </p>
              <ActionForm action={recheckPayment.bind(null, p.id)} submit="Check with CHIP" pending="Asking CHIP…" />
            </Card>
          ) : null}

          {p.status === "paid" && p.amount_cents > 0 && !p.refund_cents ? (
            <Card className="grid gap-3 rounded-3xl p-6">
              <h2 className="text-lg font-bold">Record a refund</h2>
              <p className="text-sm text-muted-foreground">
                First refund the money in the CHIP dashboard
                {p.chip_purchase_id ? (
                  <>
                    {" "}
                    (purchase <span className="font-mono text-xs">{p.chip_purchase_id}</span>)
                  </>
                ) : null}
                . Then record it here, so revenue, the CSV and the receipt show it. The event keeps its package; delete the event from its page if it should stop.
              </p>
              <ConfirmForm
                action={recordRefund.bind(null, p.id)}
                submit="Record refund"
                title="Record this refund?"
                message="Do this only after the money has gone back through CHIP. It shows on the receipt and comes off revenue."
                confirm="Record refund"
              >
                <Field label="Amount refunded (RM)" htmlFor="r-amount">
                  <Input id="r-amount" name="amount" inputMode="decimal" required defaultValue={(p.amount_cents / 100).toFixed(2)} />
                </Field>
                <Field label="Note (only admins see it)" htmlFor="r-note">
                  <Input id="r-note" name="note" maxLength={500} placeholder="e.g. Event cancelled, refunded within 7 days" />
                </Field>
              </ConfirmForm>
            </Card>
          ) : null}

          {p.refund_cents ? (
            <Card className="grid gap-3 rounded-3xl p-6">
              <h2 className="text-lg font-bold">Refund recorded</h2>
              <Notice tone="danger">
                {formatMoney(p.refund_cents)} refunded on {formatDateTime(p.refunded_at!)}.
              </Notice>
              <Confirm
                action={removeRefund.bind(null, p.id)}
                title="Remove this refund record?"
                message="Only if it was recorded by mistake. It doesn't touch any money in CHIP."
                confirm="Remove record"
                className={`${btn("outline", "sm")} w-fit`}
              >
                Remove refund record
              </Confirm>
            </Card>
          ) : null}

          <Card className="rounded-3xl p-6">
            <h2 className="mb-3 text-lg font-bold">History</h2>
            {history.length ? (
              <ol className="grid gap-3">
                {history.map((h) => (
                  <li key={h.key} className="flex gap-3 text-sm">
                    <span className={`mt-1.5 size-2 shrink-0 rounded-full ${h.tone}`} aria-hidden />
                    <span className="min-w-0">
                      <span className="block font-semibold">{h.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(h.at)} · {h.by}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted-foreground">Nothing logged for this payment yet.</p>
            )}
            {p.chip_purchase_id ? (
              <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
                <RefreshCw className="size-3.5" aria-hidden /> Callbacks from CHIP and admin actions only.
                <ExternalLink className="size-3.5" aria-hidden /> Full details are in the CHIP dashboard.
              </p>
            ) : null}
          </Card>
        </div>
      </div>
    </div>
  );
}
