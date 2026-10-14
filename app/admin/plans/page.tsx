import Link from "next/link";
import { Plus } from "lucide-react";
import { Badge, Card, LinkButton, PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { q } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import { listPlans } from "@/lib/plans";

export const metadata = { title: "Packages" };

export default async function Plans() {
  await requireAdmin();
  const plans = await listPlans(false);
  const usage = await q<{ plan_id: string; n: number }>("select plan_id, count(*)::int as n from events where paid_at is not null group by plan_id");
  const used = new Map(usage.map((u) => [u.plan_id, u.n]));
  return (
    <div className="grid gap-6">
      <PageHeader
        title="Packages"
        sub="Everything about a package is set here. Changes apply to events paid from now on; paid events keep what they bought."
        actions={
          <LinkButton href="/admin/plans/new" variant="brand">
            <Plus aria-hidden /> New package
          </LinkButton>
        }
      />
      <div className="grid gap-3">
        {plans.map((p) => (
          <Link key={p.id} href={`/admin/plans/${p.id}`}>
            <Card className="flex flex-wrap items-center justify-between gap-3 transition-shadow hover:shadow-lift">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold">{p.name}</span>
                  <span className="font-mono text-xs text-muted-foreground">{p.code}</span>
                  {!p.is_active ? <Badge tone="danger">Hidden</Badge> : null}
                  {p.is_featured ? <Badge tone="brand">Featured</Badge> : null}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {p.limits.photos_per_guest} photos/guest · {p.limits.max_photos.toLocaleString("en-MY")} photos · {p.limits.max_guests} guests · {p.limits.retention_days} days ·{" "}
                  {p.quality.name}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xl font-bold">{formatMoney(p.price_cents)}</div>
                <div className="text-xs text-muted-foreground">{used.get(p.id) ?? 0} events</div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
