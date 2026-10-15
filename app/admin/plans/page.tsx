import Link from "next/link";
import { CalendarClock, Camera, Check, Images, Pencil, Plus, Users } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { Card, Field, Input, Select, Toggle, cn } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { q } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import { ADDON_KINDS, FEATURES } from "@/lib/plan-schema";
import { listAddons, listPlans, type Addon } from "@/lib/plans";
import { saveAddon } from "../actions";

export const metadata = { title: "Packages & add-ons" };

function AddonFields({ a }: { a?: Addon }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_7rem_7rem_6rem_auto] lg:items-end">
      <Field label="Name shown to customers">
        <Input name="name" required defaultValue={a?.name} placeholder="+7 days storage" />
      </Field>
      <Field label="Gives">
        <Select name="kind" defaultValue={a?.kind ?? "retention_days"}>
          {ADDON_KINDS.map((k) => (
            <option key={k.kind} value={k.kind}>
              {k.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Amount">
        <Input name="amount" type="number" min={1} required defaultValue={a?.amount} />
      </Field>
      <Field label="Price (RM)">
        <Input name="price" inputMode="decimal" required defaultValue={a ? (a.price_cents / 100).toFixed(2) : ""} />
      </Field>
      <Field label="Order">
        <Input name="sort" type="number" defaultValue={a?.sort ?? 0} />
      </Field>
      <Toggle name="is_active" label="On sale" defaultChecked={a?.is_active ?? true} />
    </div>
  );
}

export default async function Plans({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireAdmin();
  const tab = (await searchParams).tab === "addons" ? "addons" : "packages";
  const [plans, addons, usage, addonSales] = await Promise.all([
    listPlans(false),
    listAddons(false),
    q<{ plan_id: string; n: number; cents: number }>(
      `select e.plan_id, count(distinct e.id)::int n, coalesce(sum(p.amount_cents), 0)::int cents
       from events e left join purchases p on p.event_id = e.id and p.status = 'paid' and p.kind = 'plan'
       where e.paid_at is not null group by e.plan_id`,
    ),
    q<{ addon_id: string; n: number }>("select addon_id, count(*)::int n from purchases where status = 'paid' and addon_id is not null group by addon_id"),
  ]);
  const used = new Map(usage.map((u) => [u.plan_id, u]));
  const sold = new Map(addonSales.map((a) => [a.addon_id, a.n]));

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Packages & add-ons</h1>
          <p className="mt-1 text-sm text-muted-foreground">What organisers can buy. Changes apply to new purchases; paid events keep what they bought.</p>
        </div>
        {tab === "packages" ? (
          <Link href="/admin/plans/new" className="inline-flex h-10 items-center gap-2 rounded-full bg-brand px-4 text-sm font-bold text-white shadow-cherry">
            <Plus className="size-4" aria-hidden /> New package
          </Link>
        ) : null}
      </div>

      <div className="inline-flex w-fit rounded-full border border-border bg-card p-1">
        {[
          { k: "packages", label: `Packages (${plans.length})` },
          { k: "addons", label: `Add-ons (${addons.length})` },
        ].map((t) => (
          <Link key={t.k} href={t.k === "packages" ? "/admin/plans" : "/admin/plans?tab=addons"} className={cn("rounded-full px-4 py-1.5 text-sm font-semibold", tab === t.k ? "bg-ink text-white" : "text-muted-foreground hover:text-foreground")}>
            {t.label}
          </Link>
        ))}
      </div>

      {tab === "packages" ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {plans.map((p) => {
            const u = used.get(p.id);
            const on = FEATURES.filter((f) => p.features[f.key]);
            return (
              <div key={p.id} className={cn("relative flex flex-col rounded-3xl border bg-card p-6 shadow-soft", p.is_featured ? "border-brand ring-2 ring-brand/20" : "border-border", !p.is_active && "opacity-70")}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-extrabold">{p.name}</h2>
                      {p.is_featured ? <span className="rounded-full bg-brand px-2 py-0.5 text-[11px] font-bold text-white">Most popular</span> : null}
                      {!p.is_active ? <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold text-muted-foreground">Hidden</span> : null}
                    </div>
                    <p className="mt-0.5 font-mono text-xs text-muted-foreground">{p.code}</p>
                  </div>
                  <Link href={`/admin/plans/${p.id}`} className="grid size-9 shrink-0 place-items-center rounded-full border border-border hover:bg-muted" aria-label={`Edit ${p.name}`}>
                    <Pencil className="size-4" aria-hidden />
                  </Link>
                </div>
                <div className="mt-4 text-4xl font-extrabold tracking-tight">{formatMoney(p.price_cents).replace(/\.00$/, "")}</div>
                <p className="mt-1 min-h-10 text-sm text-muted-foreground">{p.description}</p>
                <ul className="mt-4 grid grid-cols-2 gap-2 text-sm">
                  {[
                    { icon: Camera, text: `${p.limits.photos_per_guest} per guest` },
                    { icon: Users, text: `${p.limits.max_guests.toLocaleString("en-MY")} guests` },
                    { icon: Images, text: `${p.limits.max_photos.toLocaleString("en-MY")} photos` },
                    { icon: CalendarClock, text: `${p.limits.retention_days} days online` },
                  ].map((x) => (
                    <li key={x.text} className="flex items-center gap-2 rounded-xl bg-canvas px-2.5 py-2">
                      <x.icon className="size-4 shrink-0 text-brand" aria-hidden />
                      <span className="truncate font-medium">{x.text}</span>
                    </li>
                  ))}
                </ul>
                <ul className="mt-4 grid gap-1.5 text-sm">
                  {on.map((f) => (
                    <li key={f.key} className="flex items-center gap-2">
                      <Check className="size-4 shrink-0 text-ok" aria-hidden /> {f.label}
                    </li>
                  ))}
                  {FEATURES.length > on.length ? <li className="text-xs text-muted-foreground">Not included: {FEATURES.filter((f) => !p.features[f.key]).map((f) => f.label.toLowerCase()).join(", ")}</li> : null}
                </ul>
                <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-4 text-sm">
                  <span className="text-muted-foreground">{u?.n ?? 0} events sold</span>
                  <span className="font-bold">{formatMoney(u?.cents ?? 0)}</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid gap-4">
          <p className="text-sm text-muted-foreground">Extras organisers buy for a paid event (Package page of their event). They stack on top of the package.</p>
          {addons.map((a) => (
            <Card key={a.id} className="rounded-3xl p-5">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="font-bold">{a.name}</h2>
                <span className="text-xs text-muted-foreground">{sold.get(a.id) ?? 0} sold</span>
              </div>
              <ActionForm action={saveAddon.bind(null, a.id)} submit="Save">
                <AddonFields a={a} />
              </ActionForm>
            </Card>
          ))}
          <Card className="rounded-3xl border-dashed p-5">
            <h2 className="mb-3 font-bold">New add-on</h2>
            <ActionForm action={saveAddon.bind(null, null)} submit="Add add-on">
              <AddonFields />
            </ActionForm>
          </Card>
        </div>
      )}
    </div>
  );
}
