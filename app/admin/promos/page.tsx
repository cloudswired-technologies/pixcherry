import { ActionForm } from "@/components/action-form";
import { Badge, Card, Field, Input, PageHeader, Select } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { q } from "@/lib/db";
import { formatDate, formatMoney } from "@/lib/format";
import { listPlans } from "@/lib/plans";
import { savePromo, togglePromo } from "../actions";

export const metadata = { title: "Promo codes" };

export default async function Promos() {
  await requireAdmin();
  const [plans, promos] = await Promise.all([
    listPlans(false),
    q<{ id: string; code: string; percent_off: number | null; amount_off_cents: number | null; plan_name: string | null; max_uses: number | null; used_count: number; expires_at: Date | null; is_active: boolean }>(
      "select pc.*, p.name as plan_name from promo_codes pc left join plans p on p.id = pc.plan_id order by pc.created_at desc",
    ),
  ]);
  return (
    <div className="grid gap-6">
      <PageHeader title="Promo codes" sub="Work on packages and upgrades (not add-ons). A 100% code activates the event without payment." />
      <Card>
        <h2 className="mb-3 font-bold">New code</h2>
        <ActionForm action={savePromo} submit="Create code">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Code">
              <Input name="code" required placeholder="RAYA20" autoCapitalize="characters" />
            </Field>
            <Field label="Discount type">
              <Select name="type" defaultValue="percent">
                <option value="percent">Percent off</option>
                <option value="amount">RM off</option>
              </Select>
            </Field>
            <Field label="Value">
              <Input name="value" inputMode="decimal" required />
            </Field>
            <Field label="Only for package">
              <Select name="plan_id" defaultValue="">
                <option value="">Any package</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Max uses" help="Empty = unlimited">
              <Input name="max_uses" type="number" min={1} />
            </Field>
            <Field label="Valid until" help="Empty = no expiry">
              <Input name="expires" type="date" />
            </Field>
          </div>
        </ActionForm>
      </Card>
      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[40rem] text-sm">
          <thead className="bg-muted text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Code</th>
              <th className="px-4 py-2">Discount</th>
              <th className="px-4 py-2">Package</th>
              <th className="px-4 py-2">Used</th>
              <th className="px-4 py-2">Expires</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {promos.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-2 font-mono font-semibold">{p.code}</td>
                <td className="px-4 py-2">{p.percent_off ? `${p.percent_off}%` : formatMoney(p.amount_off_cents ?? 0)}</td>
                <td className="px-4 py-2">{p.plan_name ?? "Any"}</td>
                <td className="px-4 py-2">
                  {p.used_count}
                  {p.max_uses ? ` / ${p.max_uses}` : ""}
                </td>
                <td className="px-4 py-2">{p.expires_at ? formatDate(p.expires_at) : "—"}</td>
                <td className="px-4 py-2 text-right">
                  <form action={togglePromo.bind(null, p.id, !p.is_active)} className="inline-flex items-center gap-2">
                    {p.is_active ? <Badge tone="ok">Active</Badge> : <Badge>Off</Badge>}
                    <button className="text-xs font-semibold underline">{p.is_active ? "Turn off" : "Turn on"}</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
