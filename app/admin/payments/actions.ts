"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { one, q } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import { confirmWithChip } from "@/lib/payments";
import { audit } from "@/lib/settings";
import type { AdminState } from "../actions";

// Admin → Payments. The money for a refund goes back through the CHIP dashboard;
// here the refund is recorded so revenue, the receipt and the audit log show it.

const isId = (id: string) => /^[0-9a-f-]{36}$/.test(id);
const refresh = (id: string) => {
  revalidatePath(`/admin/payments/${id}`);
  revalidatePath("/admin/payments");
  revalidatePath("/admin");
};

export async function recordRefund(id: string, _: AdminState, fd: FormData): Promise<AdminState> {
  const admin = await requireAdmin();
  if (!isId(id)) return { error: "Payment not found." };
  const p = await one<{ status: string; amount_cents: number; refund_cents: number | null }>("select status, amount_cents, refund_cents from purchases where id = $1", [id]);
  if (!p) return { error: "Payment not found." };
  if (p.status !== "paid") return { error: "Only paid payments can be refunded." };
  if (p.amount_cents === 0) return { error: "This one was free, so there is nothing to refund." };
  if (p.refund_cents) return { error: "A refund is already recorded. Remove it first to change it." };
  const n = Number(String(fd.get("amount") ?? "").replace(/[^\d.]/g, ""));
  const cents = Number.isFinite(n) ? Math.round(n * 100) : 0;
  if (cents <= 0) return { error: "Enter the amount you refunded." };
  if (cents > p.amount_cents) return { error: `That's more than was paid (${formatMoney(p.amount_cents)}).` };
  const note = String(fd.get("note") ?? "").trim().slice(0, 500) || null;
  const r = await one("update purchases set refund_cents = $2, refunded_at = now(), refund_note = $3 where id = $1 and refund_cents is null returning id", [id, cents, note]);
  if (!r) return { error: "A refund was just recorded by someone else." };
  await audit(admin.id, "payment.refund", id, { refund_cents: cents, note });
  refresh(id);
  return { ok: `Refund of ${formatMoney(cents)} recorded.` };
}

export async function removeRefund(id: string) {
  const admin = await requireAdmin();
  if (!isId(id)) return;
  const p = await one<{ refund_cents: number | null }>("select refund_cents from purchases where id = $1", [id]);
  if (!p?.refund_cents) return;
  await q("update purchases set refund_cents = null, refunded_at = null, refund_note = null where id = $1", [id]);
  await audit(admin.id, "payment.refund_removed", id, { refund_cents: p.refund_cents });
  refresh(id);
}

/** For a checkout stuck on "waiting": asks CHIP directly, and activates it if CHIP says it's paid. */
export async function recheckPayment(id: string): Promise<AdminState> {
  const admin = await requireAdmin();
  if (!isId(id)) return { error: "Payment not found." };
  let status: string;
  try {
    status = await confirmWithChip(id);
  } catch (e) {
    return { error: `CHIP didn't answer: ${e instanceof Error ? e.message.slice(0, 120) : "unknown error"}. Try again in a minute.` };
  }
  await audit(admin.id, "payment.recheck", id, { status });
  refresh(id);
  if (status === "paid") return { ok: "CHIP says it's paid. The event is updated and the receipt was emailed." };
  if (status === "failed") return { ok: "CHIP says this checkout failed or was cancelled. Nothing was charged." };
  return { ok: "CHIP hasn't received the money yet. The organiser hasn't finished paying." };
}
