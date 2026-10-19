import { Badge } from "@/components/ui";
import { formatMoney } from "@/lib/format";

// Status of a payment in plain words, shared by Admin → Payments and the organiser page.

export function PaymentStatus({ p }: { p: { status: string; amount_cents: number; refund_cents: number | null } }) {
  if (p.refund_cents) return <Badge tone="danger">{p.refund_cents >= p.amount_cents ? "Refunded" : `Refunded ${formatMoney(p.refund_cents)}`}</Badge>;
  if (p.status === "paid") return <Badge tone="ok">{p.amount_cents === 0 ? "Free" : "Paid"}</Badge>;
  if (p.status === "pending") return <Badge tone="warn">Waiting</Badge>;
  if (p.status === "cancelled") return <Badge>Cancelled</Badge>;
  return <Badge>Failed</Badge>;
}
