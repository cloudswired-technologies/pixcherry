import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { SlugField } from "@/components/slug-field";
import { GUEST_PREFIX } from "@/lib/env";
import { Card, Field, Input, Notice, PageHeader, Textarea, Toggle } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { coverUrl, getManagedEvent, logoUrl } from "@/lib/events";
import { toLocalInput } from "@/lib/format";
import { regenerateLink, updateEvent, uploadCover, uploadLogo } from "../../actions";
import { DeleteEvent } from "./delete-event";
import { suggestedTags } from "@/lib/tags";

export const metadata = { title: "Event settings" };

export default async function EventSettings({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const e = await getManagedEvent(id, user);
  if (!e) notFound();
  if (e.purged_at) return <Notice tone="warn">This event&apos;s photos were deleted; its settings can no longer be changed.</Notice>;
  const f = e.cfg.features;
  const cover = coverUrl(e);
  const logo = logoUrl(e);
  return (
    <div className="grid max-w-2xl gap-6">
      <PageHeader title="Edit event" sub="Name, date, venue, cover photo and guest options." />
      <Card>
        <ActionForm action={updateEvent.bind(null, e.id)} submit="Save changes">
          <Field label="Event name" htmlFor="name">
            <Input id="name" name="name" required maxLength={120} defaultValue={e.name} />
          </Field>
          <Field label="Event link" htmlFor="slug" help="Changing it updates your QR code. The old link keeps working and sends guests to the new one.">
            <SlugField prefix={GUEST_PREFIX} defaultValue={e.slug} eventId={e.id} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Starts" htmlFor="starts_at">
              <Input id="starts_at" name="starts_at" type="datetime-local" required defaultValue={toLocalInput(e.starts_at)} />
            </Field>
            <Field label="Ends" htmlFor="ends_at" help="The storage period counts from here.">
              <Input id="ends_at" name="ends_at" type="datetime-local" required defaultValue={toLocalInput(e.ends_at)} />
            </Field>
          </div>
          <Field label="Venue (optional)" htmlFor="venue" help="Shown under the event name, e.g. “The Majestic Hotel”.">
            <Input id="venue" name="venue" maxLength={120} defaultValue={e.venue} />
          </Field>
          <Field label="Message for guests" htmlFor="description">
            <Textarea id="description" name="description" maxLength={2000} defaultValue={e.description} />
          </Field>
          {f.tags ? (
            <Field label="Hashtags guests can tap" htmlFor="suggested_tags" help="Separate with spaces. Each hashtag becomes an album in Highlights. Guests can also type their own.">
              <Input id="suggested_tags" name="suggested_tags" defaultValue={suggestedTags(e).map((t) => `#${t}`).join(" ")} />
            </Field>
          ) : null}
          <Field label="Thank-you message (optional)" htmlFor="thank_you" help="Shown on the recap page after the event — a little note from you to your guests.">
            <Textarea id="thank_you" name="thank_you" maxLength={1000} defaultValue={e.thank_you} placeholder="Thank you for celebrating with us. These photos mean the world to us! — Aina & Hakim" />
          </Field>
          <Toggle name="ask_guest_name" label="Ask guests for their name" help="Shown next to their photos. Guests can still skip it." defaultChecked={e.ask_guest_name} />
          <Toggle name="uploads_enabled" label="Accept uploads" help="Turn off to stop new photos. The gallery stays open." defaultChecked={e.uploads_enabled} />
          <Toggle
            name="require_approval"
            label="Approve photos before guests see them"
            help={f.moderation ? "New photos wait in Photos → Waiting for approval." : "Available on a higher package."}
            defaultChecked={e.require_approval}
            disabled={!f.moderation}
          />
          <Toggle
            name="one_phone_one_roll"
            label="One phone, one roll"
            help="A phone that already joined (even from another browser) continues as the same guest, with the same shots left. Turn off if many guests share one phone model on the same Wi-Fi and get mixed up — repeats are then only flagged in Guests."
            defaultChecked={e.one_phone_one_roll}
          />
          <Toggle
            name="camera_only"
            label="Disposable camera only"
            help={f.camera ? "Guests can only snap with the PixCherry camera (film filters, shots-left counter) — no uploads from the phone gallery." : "Available on a higher package."}
            defaultChecked={e.camera_only}
            disabled={!f.camera}
          />
          {f.custom_branding ? (
            <Field label="Accent colour" htmlFor="accent_color" help="Used for buttons on the guest page.">
              <Input id="accent_color" name="accent_color" type="color" defaultValue={e.accent_color ?? "#e91d48"} className="h-11 w-24 p-1" />
            </Field>
          ) : null}
        </ActionForm>
      </Card>

      <Card className="grid gap-4">
        <h2 className="text-lg font-bold">Cover photo</h2>
        {cover ? <img src={cover} alt="" className="aspect-[16/9] w-full rounded-xl object-cover" /> : null}
        <ActionForm action={uploadCover.bind(null, e.id)} submit="Upload cover" pending="Uploading…" encType="multipart/form-data">
          <input type="file" name="cover" accept="image/jpeg,image/png,image/webp" required className="text-sm" />
        </ActionForm>
        {cover ? (
          <ActionForm action={uploadCover.bind(null, e.id)} submit="Remove cover" variant="outline">
            <input type="hidden" name="remove" value="1" />
          </ActionForm>
        ) : null}
      </Card>

      {f.custom_branding ? (
        <Card className="grid gap-4">
          <h2 className="text-lg font-bold">Logo</h2>
          {logo ? <img src={logo} alt="" className="h-16 w-auto self-start" /> : null}
          <ActionForm action={uploadLogo.bind(null, e.id)} submit="Upload logo" pending="Uploading…" encType="multipart/form-data">
            <input type="file" name="logo" accept="image/png,image/webp,image/jpeg" required className="text-sm" />
          </ActionForm>
          {logo ? (
            <ActionForm action={uploadLogo.bind(null, e.id)} submit="Remove logo" variant="outline">
              <input type="hidden" name="remove" value="1" />
            </ActionForm>
          ) : null}
        </Card>
      ) : null}

      {e.paid_at ? (
        <Card className="grid gap-3">
          <h2 className="text-lg font-bold">New guest link</h2>
          <p className="text-sm text-muted-foreground">
            Makes a new link and QR code. The old QR code stops working straight away, so only do this if the link was shared somewhere it shouldn&apos;t be.
          </p>
          <form action={regenerateLink.bind(null, e.id)}>
            <button className="h-10 rounded-full bg-danger-soft px-4 text-sm font-semibold text-danger">Make a new link</button>
          </form>
        </Card>
      ) : null}

      <Card className="grid gap-3 border-danger/30">
        <h2 className="text-lg font-bold text-danger">Delete event</h2>
        <DeleteEvent id={e.id} name={e.name} paid={!!e.paid_at} />
      </Card>
    </div>
  );
}
