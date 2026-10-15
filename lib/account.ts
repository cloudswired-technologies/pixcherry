import "server-only";
import { q, tx } from "@/lib/db";
import { purgeEvent } from "@/lib/jobs";

// Closing an organiser account. Photos, guests and wishes of every event are
// deleted (same as "Delete event"); unpaid drafts go completely. Payments and
// receipts must stay for accounting, so the user row is anonymised instead of
// removed, and every open session is signed out.

export async function closeAccount(userId: string) {
  const events = await q<{ id: string; paid_at: Date | null; purged_at: Date | null }>("select id, paid_at, purged_at from events where owner_id = $1", [userId]);
  for (const e of events) {
    if (e.paid_at && !e.purged_at) await purgeEvent(e.id, userId, "deleted");
  }
  await tx(async (c) => {
    await q("delete from events where owner_id = $1 and paid_at is null", [userId], c);
    const u = await q<{ email: string }>("select email from users where id = $1", [userId], c);
    if (u[0]) await q("delete from login_codes where email = $1", [u[0].email], c);
    await q(
      `update users set email = 'deleted-' || substr(id::text, 1, 8) || '@deleted.invalid', name = null, phone = null,
         is_admin = false, session_version = session_version + 1 where id = $1`,
      [userId],
      c,
    );
    await q("insert into audit_log (actor_id, action, target, details) values ($1, 'account.closed', $1, $2)", [userId, JSON.stringify({ events: events.length })], c);
  });
}
