import "server-only";
import { one, q, tx } from "@/lib/db";
import { APP_URL } from "@/lib/env";
import { createPurchase, getPublicKey, getPurchase, type ChipCreds } from "@/lib/chip";
import { getEventById, refreshDeletion } from "@/lib/events";
import { getPlan, snapshot } from "@/lib/plans";
import { audit } from "@/lib/settings";
import { sendEmail } from "@/lib/email";
import { paidEmail } from "@/lib/email-templates";

// Event purchases: the plan itself, an upgrade (price difference) or an add-on.
// Effects are applied once, inside a transaction, only after CHIP confirms.

export type PurchaseKind = "plan" | "upgrade" | "addon";

export class PaymentError extends Error {}

export function platformChip(): ChipCreds | null {
  const brandId = process.env.PLATFORM_CHIP_BRAND_ID;
  const secretKey = process.env.PLATFORM_CHIP_SECRET_KEY;
  return brandId && secretKey ? { brandId, secretKey } : null;
}

type Promo = { id: string; code: string; percent_off: number | null; amount_off_cents: number | null; plan_id: string | null };

export async function findPromo(code: string, planId: string | null): Promise<Promo | null> {
  const c = code.trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,30}$/.test(c)) return null;
  const p = await one<Promo>(
    `select id, code, percent_off, amount_off_cents, plan_id from promo_codes
     where code = $1 and is_active and (expires_at is null or expires_at > now())
       and (max_uses is null or used_count < max_uses)`,
    [c],
  );
  if (!p || (p.plan_id && p.plan_id !== planId)) return null;
  return p;
}

export function discountFor(subtotal: number, p: Promo | null) {
  if (!p) return 0;
  const d = p.percent_off ? Math.round((subtotal * p.percent_off) / 100) : (p.amount_off_cents ?? 0);
  return Math.min(subtotal, d);
}

/** What a purchase would cost. Throws PaymentError when it isn't allowed. */
export async function quote(input: { eventId: string; kind: PurchaseKind; planId?: string; addonId?: string; promoCode?: string }) {
  const e = await getEventById(input.eventId);
  if (!e) throw new PaymentError("Event not found.");
  if (e.purged_at) throw new PaymentError("This event's photos were already deleted.");
  let subtotal = 0;
  let description = "";
  let planId: string | null = null;
  let addonId: string | null = null;

  if (input.kind === "plan") {
    if (e.paid_at) throw new PaymentError("This event is already paid.");
    const plan = input.planId ? await getPlan(input.planId) : null;
    if (!plan || !plan.is_active) throw new PaymentError("Choose a package.");
    subtotal = plan.price_cents;
    description = `${plan.name} package`;
    planId = plan.id;
  } else if (input.kind === "upgrade") {
    if (!e.paid_at || !e.plan_snapshot) throw new PaymentError("Pay for the event first.");
    const plan = input.planId ? await getPlan(input.planId) : null;
    if (!plan || !plan.is_active) throw new PaymentError("Choose a package.");
    if (plan.id === e.plan_snapshot.plan_id || plan.price_cents <= e.plan_snapshot.price_cents)
      throw new PaymentError("You can only upgrade to a higher package.");
    subtotal = plan.price_cents - e.plan_snapshot.price_cents;
    description = `Upgrade ${e.plan_snapshot.name} → ${plan.name}`;
    planId = plan.id;
  } else {
    if (!e.paid_at) throw new PaymentError("Pay for the event first.");
    const addon = input.addonId
      ? await one<{ id: string; name: string; price_cents: number }>("select id, name, price_cents from plan_addons where id = $1 and is_active", [input.addonId])
      : null;
    if (!addon) throw new PaymentError("Choose an add-on.");
    subtotal = addon.price_cents;
    description = addon.name;
    addonId = addon.id;
  }

  const promo = input.promoCode && input.kind !== "addon" ? await findPromo(input.promoCode, planId) : null;
  if (input.promoCode && input.kind !== "addon" && !promo) throw new PaymentError("That promo code isn't valid.");
  const discount = discountFor(subtotal, promo);
  return { event: e, subtotal, discount, amount: subtotal - discount, description, planId, addonId, promo };
}

/** Creates the purchase. Returns the URL to send the user to (CHIP checkout, or straight back when free). */
export async function startPurchase(user: { id: string; email: string; name: string | null }, input: Parameters<typeof quote>[0]) {
  const qt = await quote(input);
  const row = await one<{ id: string }>(
    `insert into purchases (event_id, user_id, kind, plan_id, addon_id, promo_code_id, description, subtotal_cents, discount_cents, amount_cents)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id`,
    [qt.event.id, user.id, input.kind, qt.planId, qt.addonId, qt.promo?.id ?? null, qt.description, qt.subtotal, qt.discount, qt.amount],
  );
  const id = row!.id;
  const back = `${APP_URL}/dashboard/events/${qt.event.id}/paid?purchase=${id}`;
  if (qt.amount === 0) {
    try {
      await applyPaid(id, null);
    } catch (err) {
      await q("update purchases set status = 'failed' where id = $1 and status = 'pending'", [id]);
      throw err;
    }
    return back;
  }
  const creds = platformChip();
  if (!creds) throw new PaymentError("Payments are not set up yet. Please contact support.");
  const chip = await createPurchase(creds, {
    reference: id,
    productName: `${qt.description} — ${qt.event.name}`,
    amountCents: qt.amount,
    client: { email: user.email, full_name: user.name ?? undefined },
    successRedirect: back,
    failureRedirect: `${APP_URL}/dashboard/events/${qt.event.id}/checkout?failed=1`,
    cancelRedirect: `${APP_URL}/dashboard/events/${qt.event.id}/checkout?cancelled=1`,
    successCallback: `${APP_URL}/api/chip/callback`,
  });
  await q("update purchases set chip_purchase_id = $2 where id = $1", [id, chip.id]);
  if (!chip.checkout_url) throw new PaymentError("CHIP did not return a checkout page.");
  return chip.checkout_url;
}

/** Asks CHIP directly whether the purchase is paid (used on the return page and in the callback). */
export async function confirmWithChip(purchaseId: string) {
  const p = await one<{ id: string; status: string; chip_purchase_id: string | null; amount_cents: number }>(
    "select id, status, chip_purchase_id, amount_cents from purchases where id = $1",
    [purchaseId],
  );
  if (!p) return "missing";
  if (p.status === "paid") return "paid";
  const creds = platformChip();
  if (!p.chip_purchase_id || !creds) return p.status;
  const chip = await getPurchase(creds, p.chip_purchase_id);
  if (chip.status === "paid" && chip.reference === p.id && (chip.purchase?.total ?? -1) === p.amount_cents) {
    await applyPaid(p.id, chip.id);
    return "paid";
  }
  if (["error", "cancelled", "expired", "blocked"].includes(chip.status)) {
    await q("update purchases set status = 'failed' where id = $1 and status = 'pending'", [p.id]);
    return "failed";
  }
  return p.status;
}

let cachedKey: { pem: string; at: number } | null = null;
export async function chipPublicKey() {
  const creds = platformChip();
  if (!creds) return null;
  if (!cachedKey || Date.now() - cachedKey.at > 3600_000) cachedKey = { pem: await getPublicKey(creds), at: Date.now() };
  return cachedKey.pem;
}

/** Marks a purchase paid and applies its effect. Safe to call more than once. */
export async function applyPaid(purchaseId: string, chipId: string | null) {
  const result = await tx(async (c) => {
    const p = await one<{
      id: string; event_id: string; user_id: string; kind: PurchaseKind; plan_id: string | null; addon_id: string | null;
      promo_code_id: string | null; status: string; description: string; amount_cents: number;
    }>("select * from purchases where id = $1 for update", [purchaseId], c);
    if (!p || p.status === "paid") return null;
    const receipt = await one<{ no: string }>(
      "select 'PC' || to_char(now() at time zone 'Asia/Kuala_Lumpur', 'YYYY') || '-' || lpad(nextval('receipt_seq')::text, 5, '0') as no",
      [],
      c,
    );
    await q("update purchases set status = 'paid', paid_at = now(), receipt_no = $2, chip_purchase_id = coalesce(chip_purchase_id, $3) where id = $1", [p.id, receipt!.no, chipId], c);
    await one("select id from events where id = $1 for update", [p.event_id], c);

    // The promo is claimed here, atomically, so two people using a one-time code at the
    // same moment can't both get it. A free order then fails; someone who already paid
    // CHIP the discounted price keeps it (logged for the admin).
    if (p.promo_code_id) {
      const claimed = await one(
        "update promo_codes set used_count = used_count + 1 where id = $1 and (max_uses is null or used_count < max_uses) returning id",
        [p.promo_code_id],
        c,
      );
      if (!claimed) {
        if (p.amount_cents === 0) throw new PaymentError("That promo code has just been used up.");
        await q("update promo_codes set used_count = used_count + 1 where id = $1", [p.promo_code_id], c);
        await audit(p.user_id, "promo.over_limit", p.event_id, { purchase: p.id, promo: p.promo_code_id }, c);
      }
    }

    if (p.kind === "plan" || p.kind === "upgrade") {
      const plan = p.plan_id ? await getPlan(p.plan_id, c) : null;
      if (!plan) throw new Error(`plan for purchase ${p.id} is gone`);
      // A second package paid for the same event (two checkout tabs): never downgrade; the admin refunds.
      const cur = await one<{ paid_at: Date | null; price: number | null }>(
        "select paid_at, (plan_snapshot->>'price_cents')::int as price from events where id = $1",
        [p.event_id],
        c,
      );
      if (p.kind === "plan" && cur?.paid_at) await audit(p.user_id, "purchase.duplicate", p.event_id, { purchase: p.id, amount_cents: p.amount_cents }, c);
      const keep = p.kind === "plan" && !!cur?.paid_at && (cur.price ?? 0) >= plan.price_cents;
      if (!keep)
        await q(
        `update events set plan_id = $2, plan_snapshot = $3, paid_at = coalesce(paid_at, now()), updated_at = now() where id = $1`,
        [p.event_id, plan.id, JSON.stringify(snapshot(plan))],
        c,
      );
    } else if (p.addon_id) {
      const a = await one<{ kind: string; amount: number }>("select kind, amount from plan_addons where id = $1", [p.addon_id], c);
      if (!a) throw new Error(`add-on for purchase ${p.id} is gone`);
      await q(
        `update events set addon_totals = jsonb_set(addon_totals, array[$2::text], to_jsonb(coalesce((addon_totals->>$2)::int, 0) + $3)), updated_at = now() where id = $1`,
        [p.event_id, a.kind, a.amount],
        c,
      );
    }
    await refreshDeletion(p.event_id, c);
    await audit(p.user_id, `purchase.${p.kind}.paid`, p.event_id, { purchase: p.id, amount_cents: p.amount_cents }, c);
    const owner = await one<{ email: string }>("select email from users where id = $1", [p.user_id], c);
    return { p, receiptNo: receipt!.no, email: owner!.email };
  });
  if (result && result.p.amount_cents > 0) {
    const e = await getEventById(result.p.event_id);
    await sendEmail({
      to: result.email,
      template: "paid",
      ...paidEmail({ eventName: e!.name, description: result.p.description, amountCents: result.p.amount_cents, receiptNo: result.receiptNo, eventId: e!.id }),
    });
  }
}
