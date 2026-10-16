import "server-only";
import { q } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { deletedEmail, deletionWarningEmail } from "@/lib/email-templates";
import { getSetting } from "@/lib/settings";
import { deleteObject, deletePrefix, objectExists, photoKeys } from "@/lib/storage";

// Hourly housekeeping (called by /api/cron/hourly).

/**
 * Upload slots reserved but never finished: give them back. A photo that did reach
 * storage (the phone lost the connection before confirming) is processed instead.
 */
export async function releaseStaleUploads() {
  const old = await q<{ id: string; event_id: string }>(
    "select id, event_id from photos where status = 'pending' and created_at < now() - interval '1 hour' limit 500",
  );
  for (const r of old) {
    if (await objectExists(photoKeys(r.event_id, r.id).incoming).catch(() => false)) {
      await q("update photos set status = 'uploaded', uploaded_at = now() where id = $1 and status = 'pending'", [r.id]);
    }
  }
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
    objects += await purgeEvent(r.id, null, "retention");
    if (r.photo_count > 0) await sendEmail({ to: r.email, template: "deleted", ...deletedEmail({ eventName: r.name }) });
  }
  return { events: rows.length, objects };
}

/**
 * Deletes everything guests put into an event: files in storage, wishes,
 * hearts, reports, captions, and who the guests were (name, selfie, phone and network
 * signals). Guest rows stay as anonymous counts, and the event row and its payments
 * stay (receipts, accounting).
 * Used by the retention job and by "Delete event". Returns objects removed.
 */
export async function purgeEvent(eventId: string, actorId: string | null, reason: "retention" | "deleted") {
  const objects = await deletePrefix(`ev/${eventId}/`);
  await q("update photos set status = 'deleted' where event_id = $1 and status <> 'deleted'", [eventId]);
  // Wishes and hearts are guests' personal data: they go with the photos.
  await q("delete from wishes where event_id = $1", [eventId]);
  await q("delete from photo_votes v using photos p where p.id = v.photo_id and p.event_id = $1", [eventId]);
  await q("delete from photo_reports r using photos p where p.id = r.photo_id and p.event_id = $1", [eventId]);
  await q("update photos set vote_count = 0, report_count = 0, caption = null, tags = '{}' where event_id = $1", [eventId]);
  await q(
    "update guests set name = null, avatar_key = null, device_info = null, device_hash = null, ip_hash = null, net_hash = null, addr_hash = null, extra_token_hashes = '{}' where event_id = $1",
    [eventId],
  );
  await q(
    "update events set purged_at = now(), deletion_at = least(coalesce(deletion_at, now()), now()), photo_count = 0, slot_count = 0, bytes_used = 0, cover_key = null, logo_key = null, uploads_enabled = false where id = $1",
    [eventId],
  );
  await q("insert into audit_log (actor_id, action, target, details) values ($1, 'event.purged', $2, $3)", [actorId, eventId, JSON.stringify({ reason, objects })]);
  return objects;
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
