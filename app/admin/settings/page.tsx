import { ActionForm } from "@/components/action-form";
import { Card, Field, Input, PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { saveSettings } from "../actions";

export const metadata = { title: "Settings" };

export default async function Settings() {
  await requireAdmin();
  const s = await getSettings();
  return (
    <div className="grid max-w-2xl gap-6">
      <PageHeader title="Settings" />
      <Card>
        <ActionForm action={saveSettings} submit="Save settings">
          <h2 className="font-bold">Storage and uploads</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Warn organisers before deletion (days)" help="Email + banner this many days before photos are deleted.">
              <Input name="warn_days_before_delete" type="number" min={1} max={60} required defaultValue={s.warn_days_before_delete} />
            </Field>
            <Field label="Uploads per guest per minute" help="Stops one phone flooding the album.">
              <Input name="upload_rate_per_minute" type="number" min={1} max={1000} required defaultValue={s.upload_rate_per_minute} />
            </Field>
          </div>
          <h2 className="mt-2 font-bold">Company details (receipts)</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Company name">
              <Input name="company_name" defaultValue={s.company.name} />
            </Field>
            <Field label="Registration no.">
              <Input name="company_reg_no" defaultValue={s.company.reg_no} />
            </Field>
            <Field label="Address">
              <Input name="company_address" defaultValue={s.company.address} />
            </Field>
            <Field label="Support email">
              <Input name="company_email" type="email" defaultValue={s.company.email} />
            </Field>
          </div>
        </ActionForm>
      </Card>
    </div>
  );
}
