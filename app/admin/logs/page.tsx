import { Badge, Card, LinkButton, PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { q } from "@/lib/db";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Logs" };

export default async function Logs({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireAdmin();
  const tab = (await searchParams).tab ?? "audit";
  const tabs = [
    ["audit", "Admin & payments"],
    ["email", "Emails"],
    ["webhook", "CHIP callbacks"],
  ] as const;
  return (
    <div className="grid gap-6">
      <PageHeader title="Logs" sub="Latest 200 entries." />
      <div className="flex flex-wrap gap-2">
        {tabs.map(([k, label]) => (
          <LinkButton key={k} href={`/admin/logs?tab=${k}`} variant={tab === k ? "primary" : "outline"} size="sm">
            {label}
          </LinkButton>
        ))}
      </div>
      <Card className="overflow-x-auto p-0">{tab === "email" ? <EmailLog /> : tab === "webhook" ? <WebhookLog /> : <AuditLog />}</Card>
    </div>
  );
}

const TH = "px-4 py-2 text-left text-xs font-medium text-muted-foreground";
const TD = "px-4 py-2 align-top";

async function AuditLog() {
  const rows = await q<{ id: number; action: string; target: string | null; details: unknown; created_at: Date; email: string | null }>(
    "select a.id, a.action, a.target, a.details, a.created_at, u.email from audit_log a left join users u on u.id = a.actor_id order by a.id desc limit 200",
  );
  return (
    <table className="w-full min-w-[48rem] text-sm">
      <thead className="bg-muted">
        <tr>
          <th className={TH}>When</th>
          <th className={TH}>Who</th>
          <th className={TH}>Action</th>
          <th className={TH}>Details</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {rows.map((r) => (
          <tr key={r.id}>
            <td className={`${TD} whitespace-nowrap`}>{formatDateTime(r.created_at)}</td>
            <td className={TD}>{r.email ?? "system"}</td>
            <td className={`${TD} font-mono text-xs`}>{r.action}</td>
            <td className={`${TD} max-w-md break-all font-mono text-xs text-muted-foreground`}>{JSON.stringify(r.details)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

async function EmailLog() {
  const rows = await q<{ id: number; to_email: string; template: string; ok: boolean; error: string | null; created_at: Date }>(
    "select * from email_log order by id desc limit 200",
  );
  return (
    <table className="w-full min-w-[40rem] text-sm">
      <thead className="bg-muted">
        <tr>
          <th className={TH}>When</th>
          <th className={TH}>To</th>
          <th className={TH}>Email</th>
          <th className={TH}>Result</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {rows.map((r) => (
          <tr key={r.id}>
            <td className={`${TD} whitespace-nowrap`}>{formatDateTime(r.created_at)}</td>
            <td className={TD}>{r.to_email}</td>
            <td className={`${TD} font-mono text-xs`}>{r.template}</td>
            <td className={TD}>{r.ok ? <Badge tone="ok">Sent</Badge> : <Badge tone={r.error === "not_configured" ? "neutral" : "danger"}>{r.error ?? "Failed"}</Badge>}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

async function WebhookLog() {
  const rows = await q<{ id: number; source: string; ref: string | null; ok: boolean; note: string | null; created_at: Date }>("select * from webhook_log order by id desc limit 200");
  return (
    <table className="w-full min-w-[40rem] text-sm">
      <thead className="bg-muted">
        <tr>
          <th className={TH}>When</th>
          <th className={TH}>Purchase</th>
          <th className={TH}>Result</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {rows.map((r) => (
          <tr key={r.id}>
            <td className={`${TD} whitespace-nowrap`}>{formatDateTime(r.created_at)}</td>
            <td className={`${TD} font-mono text-xs`}>{r.ref ?? "—"}</td>
            <td className={TD}>
              <Badge tone={r.ok ? "ok" : "danger"}>{r.note ?? (r.ok ? "ok" : "failed")}</Badge>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
