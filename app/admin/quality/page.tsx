import { ActionForm } from "@/components/action-form";
import { Card, Field, Input, PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { q } from "@/lib/db";
import { listPresets } from "@/lib/plans";
import { deletePreset, savePreset } from "../actions";

export const metadata = { title: "Photo quality" };

function PresetFields({ p }: { p?: { name: string; max_px: number | null; jpeg_quality: number; sort: number } }) {
  return (
    <div className="grid gap-3 sm:grid-cols-4">
      <Field label="Name">
        <Input name="name" required defaultValue={p?.name} />
      </Field>
      <Field label="Longest side (px)" help="Empty = keep original size">
        <Input name="max_px" type="number" min={640} max={12000} defaultValue={p?.max_px ?? ""} />
      </Field>
      <Field label="JPEG quality" help="50–100">
        <Input name="jpeg_quality" type="number" min={50} max={100} required defaultValue={p?.jpeg_quality ?? 85} />
      </Field>
      <Field label="Order">
        <Input name="sort" type="number" defaultValue={p?.sort ?? 0} />
      </Field>
    </div>
  );
}

export default async function Quality() {
  await requireAdmin();
  const presets = await listPresets();
  const used = new Set((await q<{ id: string }>("select distinct quality_preset_id as id from plans")).map((r) => r.id));
  return (
    <div className="grid gap-6">
      <PageHeader
        title="Photo quality"
        sub="Presets that packages pick from. The guest's phone resizes to this size before uploading, and the server re-encodes at this JPEG quality."
      />
      {presets.map((p) => (
        <Card key={p.id} className="grid gap-3">
          <ActionForm action={savePreset.bind(null, p.id)} submit="Save">
            <PresetFields p={p} />
          </ActionForm>
          {!used.has(p.id) ? (
            <form action={deletePreset.bind(null, p.id)}>
              <button className="text-sm text-danger underline">Delete (not used by any package)</button>
            </form>
          ) : null}
        </Card>
      ))}
      <Card>
        <h2 className="mb-3 font-bold">New preset</h2>
        <ActionForm action={savePreset.bind(null, null)} submit="Add preset">
          <PresetFields />
        </ActionForm>
      </Card>
    </div>
  );
}
