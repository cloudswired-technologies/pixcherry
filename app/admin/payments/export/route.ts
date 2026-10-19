import { PAYMENT_FILTERS, listPayments, monthRange, type PaymentFilter } from "@/lib/admin-data";
import { requireAdmin } from "@/lib/auth";

// Admin → Payments → Download CSV, with the same filters as the page. For the accountant:
// Malaysian times, ringgit with two decimals, net = paid − refunded. Opens in Excel (BOM).

export const dynamic = "force-dynamic";

const TZ = "Asia/Kuala_Lumpur";
const ringgit = (cents: number | null) => (cents == null ? "" : (cents / 100).toFixed(2));
const when = (d: Date | null) => (d ? new Date(d).toLocaleString("sv-SE", { timeZone: TZ }).slice(0, 16) : "");
/** Quotes a cell; a leading = + - @ is defused so a spreadsheet never runs it as a formula. */
const cell = (v: string | number) => {
  const s = String(v);
  return `"${(/^[=+\-@\t\r]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
};

export async function GET(req: Request) {
  await requireAdmin();
  const sp = new URL(req.url).searchParams;
  const raw = sp.get("status") ?? "";
  const status: PaymentFilter = raw in PAYMENT_FILTERS ? (raw as PaymentFilter) : "all";
  const month = monthRange(sp.get("month") ?? undefined);
  const rows = await listPayments({ filter: status, term: (sp.get("q") ?? "").trim().slice(0, 100), month }, 5000);
  const head = ["Date (MYT)", "Receipt no", "Status", "Organiser email", "Organiser name", "Event", "Item", "Type", "Promo code", "Subtotal (RM)", "Discount (RM)", "Paid (RM)", "Refunded (RM)", "Net (RM)", "Refund date (MYT)", "Refund note", "CHIP purchase id", "PixCherry payment id"];
  const lines = rows.map((p) =>
    [
      when(p.paid_at ?? p.created_at),
      p.receipt_no ?? "",
      p.refund_cents ? "refunded" : p.status,
      p.email,
      p.name ?? "",
      p.event,
      p.description,
      p.kind,
      p.promo ?? "",
      ringgit(p.subtotal_cents),
      ringgit(p.discount_cents),
      ringgit(p.amount_cents),
      ringgit(p.refund_cents),
      p.status === "paid" ? ringgit(p.amount_cents - (p.refund_cents ?? 0)) : "0.00",
      when(p.refunded_at),
      p.refund_note ?? "",
      p.chip_purchase_id ?? "",
      p.id,
    ]
      .map(cell)
      .join(","),
  );
  const csv = `﻿${[head.map(cell).join(","), ...lines].join("\r\n")}\r\n`;
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: TZ });
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="pixcherry-payments-${month ?? "all"}-${today}.csv"`,
      "cache-control": "no-store",
    },
  });
}
