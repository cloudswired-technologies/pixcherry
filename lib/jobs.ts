import "server-only";
import { q } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { deletedEmail, deletionWarningEmail } from "@/lib/email-templates";
import { getSetting } from "@/lib/settings";
import { deleteObject, deletePrefix, photoKeys } from "@/lib/storage";

// Hourly housekeeping (called by /api/cron/hourly).

/** Upload slots reserved but never finished: give them back. */
export async function releaseStaleUploads() {
  const rows = await q<{ id: string; event_id: string; guest_id: string | null }>(
    `update photos set status = 'failed', error = 'upload not finished'
     where status = 'pending' and created_at < now() - interval '1 hour' returning id, event_id, guest_id`,
  );
  for (const r of rows) {
    if (r.guest_id) await q("update guests set upload_count = greatest(0, upload_count - 1) where id = $1", [r.guest_id]);
    await q("update events set slot_count = greatest(0, slot_count - 1) where id = $1", [r.event_id]);
    await deleteObject(photoKeys(r.event_id, r.id).incoming).catch(() => {});
  }
  return rows.length;
}

export async function sendDeletionWarnings() {
  const days = Number(await getSetting("warn_days_before_delete")) || 3;
  const rows = await q<{ id: string; name: string; deletion_at: Date; photo_count: number; email: string }>(
    `select e.id, e.name, e.deletion_at, e.photo_count, u.email from events e join users u on u.id = e.owner_id
     where e.paid_at is not null and e.purged_at is null and e.warned_at is null
       and e.deletion_at <= now() + make_interval(days => $1) and e.deletion_at > now()
     limit 200`,
    [days],
  );
  for (const r of rows) {
    await q("update events set warned_at = now() where id = $1", [r.id]);
    if (r.photo_count > 0) {
      await sendEmail({ to: r.email, template: "deletion_warning", ...deletionWarningEmail({ eventName: r.name, deletionAt: r.deletion_at, eventId: r.id, photos: r.photo_count }) });
    }
  }
  return rows.length;
}

export async function purgeExpiredEvents() {
  const rows = await q<{ id: string; name: string; email: string; photo_count: number }>(
    `select e.id, e.name, u.email, e.photo_count from events e join users u on u.id = e.owner_id
     where e.paid_at is not null and e.purged_at is null and e.deletion_at <= now() order by e.deletion_at limit 50`,
  );
  let objects = 0;
  for (const r of rows) {
    objects += await deletePrefix(`ev/${r.id}/`);
    await q("update photos set status = 'deleted' where event_id = $1 and status <> 'deleted'", [r.id]);
    await q("update events set purged_at = now(), photo_count = 0, slot_count = 0, bytes_used = 0, cover_key = null, logo_key = null, uploads_enabled = false where id = $1", [r.id]);
    await q("insert into audit_log (action, target, details) values ('event.purged', $1, $2)", [r.id, JSON.stringify({ photos: r.photo_count })]);
    if (r.photo_count > 0) await sendEmail({ to: r.email, template: "deleted", ...deletedEmail({ eventName: r.name }) });
  }
  return { events: rows.length, objects };
}

/** Unpaid drafts older than 30 days and old login codes. */
export async function cleanup() {
  const drafts = await q("delete from events where paid_at is null and created_at < now() - interval '30 days' returning id");
  for (const d of drafts as { id: string }[]) await deletePrefix(`ev/${d.id}/`).catch(() => {});
  await q("delete from login_codes where created_at < now() - interval '1 day'");
  return drafts.length;
}

export async function runHourly() {
  const stale = await releaseStaleUploads();
  const warned = await sendDeletionWarnings();
  const purged = await purgeExpiredEvents();
  const drafts = await cleanup();
  await q("insert into settings (key, value, updated_at) values ('last_cron', $1, now()) on conflict (key) do update set value = excluded.value, updated_at = now()", [
    JSON.stringify({ at: new Date().toISOString(), stale, warned, purged, drafts }),
  ]);
  return { stale, warned, purged, drafts };
}
