import { notFound } from "next/navigation";
import { PrintButton } from "@/components/print-button";
import { Logo } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { one } from "@/lib/db";
import { formatDateTime, formatMoney } from "@/lib/format";
import { getSetting } from "@/lib/settings";

export const metadata = { title: "Receipt" };

export default async function Receipt({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const user = await requireUser();
  const p = await one<{
    receipt_no: string; description: string; subtotal_cents: number; discount_cents: number; amount_cents: number; paid_at: Date;
    event_name: string; email: string; name: string | null; user_id: string;
  }>(
    `select p.receipt_no, p.description, p.subtotal_cents, p.discount_cents, p.amount_cents, p.paid_at, e.name as event_name, u.email, u.name, p.user_id
     from purchases p join events e on e.id = p.event_id join users u on u.id = p.user_id where p.id = $1 and p.status = 'paid'`,
    [id],
  );
  if (!p || (p.user_id !== user.id && !user.is_admin)) notFound();
  const company = await getSetting("company");
  return (
    <div className="grid justify-items-center gap-6">
      <div className="print:hidden">
        <PrintButton />
      </div>
      <div className="w-full max-w-xl rounded-2xl border border-border bg-white p-8 text-sm print:border-0">
        <div className="flex items-start justify-between gap-4">
          <Logo className="text-lg" />
          <div className="text-right">
            <div className="text-lg font-bold">Receipt</div>
            <div className="text-muted-foreground">{p.receipt_no}</div>
          </div>
        </div>
        <div className="mt-6 grid gap-1 text-muted-foreground">
          <div className="font-semibold text-foreground">
            {company.name}
            {company.reg_no ? ` (${company.reg_no})` : ""}
          </div>
          <div>{company.address}</div>
          <div>{company.email}</div>
        </div>
        <div className="mt-6 grid gap-1">
          <div className="text-muted-foreground">Billed to</div>
          <div className="font-semibold">{p.name ?? p.email}</div>
          {p.name ? <div>{p.email}</div> : null}
        </div>
        <table className="mt-6 w-full">
          <tbody className="divide-y divide-border">
            <tr>
              <td className="py-2">
                {p.description}
                <div className="text-xs text-muted-foreground">{p.event_name}</div>
              </td>
              <td className="py-2 text-right">{formatMoney(p.subtotal_cents)}</td>
            </tr>
            {p.discount_cents ? (
              <tr>
                <td className="py-2">Discount</td>
                <td className="py-2 text-right">−{formatMoney(p.discount_cents)}</td>
              </tr>
            ) : null}
            <tr className="font-bold">
              <td className="py-2">Total paid</td>
              <td className="py-2 text-right">{formatMoney(p.amount_cents)}</td>
            </tr>
          </tbody>
        </table>
        <div className="mt-6 text-xs text-muted-foreground">Paid {formatDateTime(p.paid_at)}. This is a computer-generated receipt.</div>
      </div>
    </div>
  );
}
