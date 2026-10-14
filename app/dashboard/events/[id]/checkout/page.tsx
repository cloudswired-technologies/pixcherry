import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { PlanCard } from "@/components/plan-card";
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
      <PageHeader title="Upgrade or add more" sub={`Current package: ${current.name}`} />
      {banner ? <Notice tone="warn">{banner}</Notice> : null}

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

      {addons.length ? (
        <section className="grid gap-4">
          <h2 className="text-lg font-bold">Add-ons</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {addons.map((a) => (
              <Card key={a.id} className="grid gap-3">
                <div className="font-bold">{a.name}</div>
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
    </div>
  );
}
