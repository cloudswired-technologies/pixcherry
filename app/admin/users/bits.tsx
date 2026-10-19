import { Badge, cn } from "@/components/ui";
import { formatMoney } from "@/lib/format";

// Small pieces shared by the organiser list and the organiser page.

export function Initial({ name, email, className }: { name: string | null; email: string; className?: string }) {
  return (
    <span className={cn("grid size-10 shrink-0 place-items-center rounded-2xl bg-brand-soft text-sm font-extrabold uppercase text-brand-strong", className)} aria-hidden>
      {(name ?? email).charAt(0)}
    </span>
  );
}

export function UserBadges({ u }: { u: { email: string; is_admin: boolean; suspended_at: Date | null; is_new: boolean; spent: number } }) {
  const closed = u.email.endsWith("@deleted.invalid");
  const fresh = u.is_new;
  return (
    <span className="flex flex-wrap gap-1">
      {closed ? <Badge>Closed</Badge> : null}
      {u.suspended_at ? <Badge tone="danger">Suspended</Badge> : null}
      {u.is_admin ? <Badge tone="brand">Admin</Badge> : null}
      {!closed && !u.suspended_at && u.spent > 0 ? <Badge tone="ok">Customer</Badge> : null}
      {!closed && fresh ? <Badge tone="warn">New</Badge> : null}
    </span>
  );
}

export const money = (cents: number) => (cents ? formatMoney(cents) : "—");
