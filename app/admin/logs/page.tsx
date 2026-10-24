import { Badge, Card, LinkButton, PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { q } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { ACTION_LABEL } from "@/lib/admin-data";

export const metadata = { title: "Logs" };

export default async function Logs({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const tab = sp.tab ?? "audit";
  const term = (sp.q ?? "").trim().slice(0, 100);
  const tabs = [
    ["audit", "Admin & payments"],
    ["email", "Emails"],
    ["webhook", "CHIP callbacks"],
  ] as const;
  return (
    <div className="grid gap-6">
      <PageHeader title="Logs" sub={term ? `Latest 200 entries matching “${term}”.` : "Latest 200 entries."} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {tabs.map(([k, label]) => (
            <LinkButton key={k} href={`/admin/logs?tab=${k}${term ? `&q=${encodeURIComponent(term)}` : ""}`} variant={tab === k ? "primary" : "outline"} size="sm">
              {label}
            </LinkButton>
          ))}
        </div>
        <form className="w-full sm:w-72">
          <input type="hidden" name="tab" value={tab} />
          <input name="q" defaultValue={term} placeholder="Search email, action or id" aria-label="Search logs" className="h-10 w-full rounded-full border border-input bg-card px-4 text-sm outline-none focus:border-brand" />
        </form>
      </div>
      <Card className="overflow-x-auto p-0">{tab === "email" ? <EmailLog term={term} /> : tab === "webhook" ? <WebhookLog term={term} /> : <AuditLog term={term} />}</Card>
    </div>
  );
}

const TH = "px-4 py-2 text-left text-xs font-medium text-muted-foreground";
const TD = "px-4 py-2 align-top";

const like = (s: string) => `%${s.replace(/[%_\\]/g, "\\$&")}%`;

async function AuditLog({ term }: { term: string }) {
  const rows = await q<{ id: number; action: string; target: string | null; details: unknown; created_at: Date; email: string | null }>(
    `select a.id, a.action, a.target, a.details, a.created_at, u.email from audit_log a left join users u on u.id = a.actor_id
     ${term ? "where a.action ilike $1 or u.email ilike $1 or a.target ilike $1 or a.details::text ilike $1" : ""} order by a.id desc limit 200`,
    term ? [like(term)] : [],
  );
  return (
    <>
    <MobileRows rows={rows.map((r) => ({ key: r.id, when: r.created_at, title: ACTION_LABEL[r.action] ?? r.action, sub: r.email ?? "system", extra: JSON.stringify(r.details) }))} />
    <table className="hidden w-full min-w-[48rem] text-sm md:table">
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
    </>
  );
}

async function EmailLog({ term }: { term: string }) {
  const rows = await q<{ id: number; to_email: string; template: string; ok: boolean; error: string | null; created_at: Date }>(
    `select * from email_log ${term ? "where to_email ilike $1 or template ilike $1" : ""} order by id desc limit 200`,
    term ? [like(term)] : [],
  );
  return (
    <>
    <MobileRows
      rows={rows.map((r) => ({
        key: r.id,
        when: r.created_at,
        title: r.template,
        sub: r.to_email,
        badge: r.ok ? <Badge tone="ok">Sent</Badge> : <Badge tone={r.error === "not_configured" ? "neutral" : "danger"}>{r.error ?? "Failed"}</Badge>,
      }))}
    />
    <table className="hidden w-full min-w-[40rem] text-sm md:table">
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
    </>
  );
}

async function WebhookLog({ term }: { term: string }) {
  const rows = await q<{ id: number; source: string; ref: string | null; ok: boolean; note: string | null; created_at: Date }>(
    `select * from webhook_log ${term ? "where ref ilike $1 or note ilike $1" : ""} order by id desc limit 200`,
    term ? [like(term)] : [],
  );
  return (
    <>
    <MobileRows
      rows={rows.map((r) => ({ key: r.id, when: r.created_at, title: r.ref ?? "—", sub: "CHIP callback", badge: <Badge tone={r.ok ? "ok" : "danger"}>{r.note ?? (r.ok ? "ok" : "failed")}</Badge> }))}
    />
    <table className="hidden w-full min-w-[40rem] text-sm md:table">
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
    </>
  );
}

/** Phones: one compact row per log entry instead of a table that scrolls sideways. */
function MobileRows({ rows }: { rows: { key: number; when: Date; title: string; sub: string; badge?: React.ReactNode; extra?: string }[] }) {
  if (!rows.length) return <p className="px-4 py-8 text-center text-sm text-muted-foreground md:hidden">Nothing logged yet.</p>;
  return (
    <ul className="divide-y divide-border md:hidden">
      {rows.map((r) => (
        <li key={r.key} className="flex items-start gap-3 px-4 py-3">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{r.title}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {formatDateTime(r.when)} · {r.sub}
            </span>
            {r.extra && r.extra !== "{}" ? <span className="mt-0.5 block truncate font-mono text-[11px] text-muted-foreground">{r.extra}</span> : null}
          </span>
          {r.badge ? <span className="shrink-0">{r.badge}</span> : null}
        </li>
      ))}
    </ul>
  );
}
