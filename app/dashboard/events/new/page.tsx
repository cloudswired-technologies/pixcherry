import { ActionForm } from "@/components/action-form";
import { Card, Field, Input, PageHeader, Textarea } from "@/components/ui";
import { defaultEventTimes, toLocalInput } from "@/lib/format";
import { createEvent } from "../actions";

export const metadata = { title: "New event" };

export default async function NewEvent({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const { plan } = await searchParams;
  const { start: sat, end } = defaultEventTimes();
  return (
    <div className="mx-auto grid max-w-xl gap-6">
      <PageHeader title="Create your event" sub="You can change all of this later." />
      <Card>
        <ActionForm action={createEvent} submit="Continue to package" pending="Creating…" variant="brand" fullWidth>
          <input type="hidden" name="plan" value={plan ?? ""} />
          <Field label="Event name" htmlFor="name" help="Shown to guests, e.g. “Aina & Hakim's Wedding”.">
            <Input id="name" name="name" required maxLength={120} autoFocus />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Starts" htmlFor="starts_at">
              <Input id="starts_at" name="starts_at" type="datetime-local" required defaultValue={toLocalInput(sat)} />
            </Field>
            <Field label="Ends" htmlFor="ends_at">
              <Input id="ends_at" name="ends_at" type="datetime-local" required defaultValue={toLocalInput(end)} />
            </Field>
          </div>
          <Field label="Message for guests (optional)" htmlFor="description">
            <Textarea id="description" name="description" maxLength={2000} placeholder="Thank you for celebrating with us! Share your photos here." />
          </Field>
        </ActionForm>
      </Card>
    </div>
  );
}
