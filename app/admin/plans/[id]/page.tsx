import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { PlanCard } from "@/components/plan-card";
import { Card, Field, Input, Notice, Textarea, Toggle } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { one } from "@/lib/db";
import { storageCostMyr, typicalPhotoBytes } from "@/lib/costs";
import { formatBytes, formatMoney } from "@/lib/format";
import { FEATURES, LIMITS, normaliseFeatures, normaliseLimits } from "@/lib/plan-schema";
import { getPlan, type Plan } from "@/lib/plans";
import { savePlan } from "../../actions";

export const metadata = { title: "Package" };

export default async function PlanEdit({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const { saved } = await searchParams;
  const isNew = id === "new";
  const plan = isNew ? null : await getPlan(id);
  if (!isNew && !plan) notFound();
  const limits = plan?.limits ?? normaliseLimits({});
  const features = plan?.features ?? normaliseFeatures({});

  // Real average stored size per photo for this package, if we have data.
  const avg = plan
    ? await one<{ avg: number | null }>(
        "select avg(p.bytes)::float as avg from photos p join events e on e.id = p.event_id where e.plan_id = $1 and p.bytes is not null",
        [plan.id],
      )
    : null;
  const perPhoto = avg?.avg ?? typicalPhotoBytes(3072);
  const fullBytes = perPhoto * limits.max_photos;
  const months = (limits.retention_days + 2) / 30;

  return (
    <div className="grid gap-6">
      <Link href="/admin/plans" className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Packages
      </Link>
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">{isNew ? "New package" : plan!.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Changes apply to events paid from now on. Paid events keep what they bought.</p>
      </div>
      {saved ? <Notice tone="ok">Saved.</Notice> : null}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <Card className="rounded-3xl p-6">
          <ActionForm action={savePlan.bind(null, isNew ? null : plan!.id)} submit={isNew ? "Create package" : "Save package"}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name" htmlFor="name">
                <Input id="name" name="name" required defaultValue={plan?.name} />
              </Field>
              <Field label="Code" htmlFor="code" help="Used in links like /dashboard/events/new?plan=basic">
                <Input id="code" name="code" required pattern="[a-z0-9-]{2,40}" defaultValue={plan?.code} />
              </Field>
              <Field label="Price (RM)" htmlFor="price">
                <Input id="price" name="price" inputMode="decimal" required defaultValue={plan ? (plan.price_cents / 100).toFixed(2) : ""} />
              </Field>
            </div>
            <Field label="Description" htmlFor="description">
              <Input id="description" name="description" maxLength={300} defaultValue={plan?.description} />
            </Field>

            <h3 className="mt-4 border-t border-border pt-5 text-lg font-bold">Limits</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              {LIMITS.map((l) => (
                <Field key={l.key} label={`${l.label} (${l.unit})`} htmlFor={`limit_${l.key}`} help={l.help}>
                  <Input id={`limit_${l.key}`} name={`limit_${l.key}`} type="number" min={l.min} max={l.max} required defaultValue={limits[l.key]} />
                </Field>
              ))}
            </div>

            <h3 className="mt-4 border-t border-border pt-5 text-lg font-bold">Features</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {FEATURES.map((f) => (
                <Toggle key={f.key} name={`feature_${f.key}`} label={f.label} help={f.help} defaultChecked={features[f.key]} />
              ))}
            </div>

            <Field label="Extra lines on the pricing card" htmlFor="highlights" help="One per line. Limits and features above are listed automatically.">
              <Textarea id="highlights" name="highlights" defaultValue={plan?.highlights.join("\n")} />
            </Field>
            <div className="grid gap-2 sm:grid-cols-3">
              <Toggle name="is_active" label="Available to buy" defaultChecked={plan?.is_active ?? true} />
              <Toggle name="is_featured" label="Mark as most popular" defaultChecked={plan?.is_featured ?? false} />
              <Field label="Order" htmlFor="sort">
                <Input id="sort" name="sort" type="number" defaultValue={plan?.sort ?? 0} />
              </Field>
            </div>
          </ActionForm>
        </Card>
        <div className="grid content-start gap-4 xl:sticky xl:top-8">
          {plan ? <PlanCard plan={plan as Plan} compact /> : null}
          <Card className="grid gap-1 rounded-3xl text-sm">
            <div className="font-bold">Cost check</div>
            <p className="text-muted-foreground">
              About {formatBytes(perPhoto)} per photo{avg?.avg ? " (from real uploads)" : " (estimate)"}. A completely full album is {formatBytes(fullBytes)} and costs about{" "}
              <strong className="text-foreground">{storageCostMyr(fullBytes, months)}</strong> in storage for its {limits.retention_days} days.
            </p>
            {plan ? <p className="text-muted-foreground">Price {formatMoney(plan.price_cents)} before CHIP fees.</p> : null}
          </Card>
        </div>
      </div>
    </div>
  );
}
