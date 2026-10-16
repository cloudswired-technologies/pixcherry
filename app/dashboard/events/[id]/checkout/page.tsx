import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { PlanCard } from "@/components/plan-card";
import { PackageBenefits } from "@/components/package-benefits";
import { ADDON_KINDS } from "@/lib/plan-schema";
import { Card, Field, Input, Notice, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getManagedEvent } from "@/lib/events";
import { formatDate, formatMoney } from "@/lib/format";
import { listAddons, listPlans } from "@/lib/plans";
import { checkout } from "../../actions";

export const metadata = { title: "Package" };

export default async function Checkout({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ plan?: string; failed?: string; cancelled?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireUser();
  const e = await getManagedEvent(id, user);
  if (!e) notFound();
  const [plans, addons] = await Promise.all([listPlans(), listAddons()]);
  const action = checkout.bind(null, e.id);
  const banner = sp.failed ? "The payment didn't go through. You can try again." : sp.cancelled ? "Payment cancelled. Nothing was charged." : null;

  if (e.purged_at) {
    return <Notice tone="warn">This event&apos;s photos were deleted, so nothing more can be bought for it.</Notice>;
  }

  const back = (
    <Link href={`/dashboard/events/${e.id}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
      <ArrowLeft className="size-4" aria-hidden /> {e.name}
    </Link>
  );

  if (!e.paid_at) {
    const chosen = plans.find((p) => p.code === sp.plan) ?? plans.find((p) => p.is_featured) ?? plans[0];
    return (
      <div className="grid gap-6">
        {back}
        <PageHeader title="Choose a package" sub={`${e.name} · ${formatDate(e.starts_at)}`} />
        {banner ? <Notice tone="warn">{banner}</Notice> : null}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {plans.map((p) => (
            <PlanCard
              key={p.id}
              plan={p}
              action={
                <ActionForm action={action} submit={`Pay ${formatMoney(p.price_cents)}`} pending="Opening payment…" variant={p.id === chosen?.id ? "brand" : "primary"} fullWidth>
                  <input type="hidden" name="kind" value="plan" />
                  <input type="hidden" name="plan_id" value={p.id} />
                  <Field label="Promo code (optional)" htmlFor={`promo-${p.id}`}>
                    <Input id={`promo-${p.id}`} name="promo" autoCapitalize="characters" maxLength={30} />
                  </Field>
                </ActionForm>
              }
            />
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Payment by FPX online banking or card through CHIP. Your QR code is ready as soon as the payment is confirmed.</p>
      </div>
    );
  }

  const current = e.plan_snapshot!;
  const upgrades = plans.filter((p) => p.price_cents > current.price_cents && p.id !== current.plan_id);
  return (
    <div className="grid gap-8">
      {back}
      <PageHeader title="Your package" sub="Everything this event includes. Need more? Add it below — it adds to this list straight away." />
      {banner ? <Notice tone="warn">{banner}</Notice> : null}

      <Card className="grid gap-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-brand">Current package</div>
            <h2 className="text-2xl font-extrabold">{current.name}</h2>
          </div>
          <div className="text-sm text-muted-foreground">Paid {formatMoney(current.price_cents)} · photos online until {e.deletion_at ? formatDate(e.deletion_at) : "—"}</div>
        </div>
        <PackageBenefits cfg={e.cfg} addons={(e.addon_totals ?? {}) as Record<string, number>} />
      </Card>

      {addons.length ? (
        <section className="grid gap-4">
          <div>
            <h2 className="text-lg font-bold">Add-ons</h2>
            <p className="text-sm text-muted-foreground">Top up just what you need. Each one adds to your package above.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {addons.map((a) => (
              <Card key={a.id} className="grid gap-3">
                <div className="font-bold">{a.name}</div>
                <div className="text-sm text-muted-foreground">
                  {ADDON_KINDS.find((k) => k.kind === a.kind)?.label}: now {e.cfg.limits[a.kind as keyof typeof e.cfg.limits].toLocaleString("en-MY")} → {(e.cfg.limits[a.kind as keyof typeof e.cfg.limits] + a.amount).toLocaleString("en-MY")}
                </div>
                <div className="text-2xl font-bold">{formatMoney(a.price_cents)}</div>
                <ActionForm action={action} submit="Buy" pending="Opening payment…" fullWidth>
                  <input type="hidden" name="kind" value="addon" />
                  <input type="hidden" name="addon_id" value={a.id} />
                </ActionForm>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      {upgrades.length ? (
        <section className="grid gap-4">
          <h2 className="text-lg font-bold">Upgrade your package</h2>
          <p className="text-sm text-muted-foreground">You only pay the difference. Photos already uploaded stay as they are; the new settings apply from now on.</p>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {upgrades.map((p) => (
              <PlanCard
                key={p.id}
                plan={p}
                compact
                action={
                  <ActionForm action={action} submit={`Upgrade for ${formatMoney(p.price_cents - current.price_cents)}`} pending="Opening payment…" variant="brand" fullWidth>
                    <input type="hidden" name="kind" value="upgrade" />
                    <input type="hidden" name="plan_id" value={p.id} />
                    <Field label="Promo code (optional)" htmlFor={`promo-${p.id}`}>
                      <Input id={`promo-${p.id}`} name="promo" autoCapitalize="characters" maxLength={30} />
                    </Field>
                  </ActionForm>
                }
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
