import { ActionForm } from "@/components/action-form";
import { Card, Field, Input, PageHeader, Select, Toggle } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { ADDON_KINDS } from "@/lib/plan-schema";
import { listAddons, type Addon } from "@/lib/plans";
import { saveAddon } from "../actions";

export const metadata = { title: "Add-ons" };

function AddonFields({ a }: { a?: Addon }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Field label="Gives">
        <Select name="kind" defaultValue={a?.kind ?? "retention_days"}>
          {ADDON_KINDS.map((k) => (
            <option key={k.kind} value={k.kind}>
              {k.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Amount" help="Days, photos or guests added">
        <Input name="amount" type="number" min={1} required defaultValue={a?.amount} />
      </Field>
      <Field label="Price (RM)">
        <Input name="price" inputMode="decimal" required defaultValue={a ? (a.price_cents / 100).toFixed(2) : ""} />
      </Field>
      <Field label="Name shown to customers">
        <Input name="name" required defaultValue={a?.name} placeholder="+7 days storage" />
      </Field>
      <Field label="Order">
        <Input name="sort" type="number" defaultValue={a?.sort ?? 0} />
      </Field>
      <div className="self-end">
        <Toggle name="is_active" label="Available" defaultChecked={a?.is_active ?? true} />
      </div>
    </div>
  );
}

export default async function Addons() {
  await requireAdmin();
  const addons = await listAddons(false);
  return (
    <div className="grid gap-6">
      <PageHeader title="Add-ons" sub="Extras organisers can buy for a paid event. They stack on top of the package." />
      {addons.map((a) => (
        <Card key={a.id}>
          <ActionForm action={saveAddon.bind(null, a.id)} submit="Save">
            <AddonFields a={a} />
          </ActionForm>
        </Card>
      ))}
      <Card>
        <h2 className="mb-3 font-bold">New add-on</h2>
        <ActionForm action={saveAddon.bind(null, null)} submit="Add">
          <AddonFields />
        </ActionForm>
      </Card>
    </div>
  );
}
