import Link from "next/link";
import { PhaseBadge } from "@/components/event-bits";
import { Card, Input, PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { q } from "@/lib/db";
import { formatBytes, formatDate } from "@/lib/format";
import { eventPhase } from "@/lib/limits";

export const metadata = { title: "Events" };

export default async function AdminEvents({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireAdmin();
  const term = ((await searchParams).q ?? "").trim().slice(0, 100);
  const rows = await q<{
    id: string; name: string; slug: string; starts_at: Date; ends_at: Date; paid_at: Date | null; purged_at: Date | null; deletion_at: Date | null;
    photo_count: number; guest_count: number; bytes_used: string; email: string; plan: string | null;
  }>(
    `select e.id, e.name, e.slug, e.starts_at, e.ends_at, e.paid_at, e.purged_at, e.deletion_at, e.photo_count, e.guest_count, e.bytes_used,
       u.email, e.plan_snapshot->>'name' as plan
     from events e join users u on u.id = e.owner_id
     ${term ? "where e.name ilike $1 or u.email ilike $1 or e.slug = lower($2)" : ""}
     order by e.created_at desc limit 200`,
    term ? [`%${term.replace(/[%_\\]/g, "\\$&")}%`, term] : [],
  );
  return (
    <div className="grid gap-6">
      <PageHeader title="Events" />
      <form>
        <Input name="q" defaultValue={term} placeholder="Search by event name, owner email or link code" />
      </form>
      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[52rem] text-sm">
          <thead className="bg-muted text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Event</th>
              <th className="px-4 py-2">Owner</th>
              <th className="px-4 py-2">Package</th>
              <th className="px-4 py-2">Photos</th>
              <th className="px-4 py-2">Storage</th>
              <th className="px-4 py-2">Deletes</th>
              <th className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((e) => (
              <tr key={e.id}>
                <td className="px-4 py-2">
                  <Link href={`/admin/events/${e.id}`} className="font-medium hover:underline">
                    {e.name}
                  </Link>
                  <div className="text-xs text-muted-foreground">{formatDate(e.starts_at)}</div>
                </td>
                <td className="px-4 py-2">{e.email}</td>
                <td className="px-4 py-2">{e.plan ?? "—"}</td>
                <td className="px-4 py-2">
                  {e.photo_count} <span className="text-xs text-muted-foreground">/ {e.guest_count} guests</span>
                </td>
                <td className="px-4 py-2">{formatBytes(Number(e.bytes_used))}</td>
                <td className="px-4 py-2">{e.deletion_at && !e.purged_at ? formatDate(e.deletion_at) : "—"}</td>
                <td className="px-4 py-2">
                  <PhaseBadge phase={eventPhase(e)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
