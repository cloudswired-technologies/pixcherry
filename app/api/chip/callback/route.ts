import { NextResponse } from "next/server";
import { verifyCallback } from "@/lib/chip";
import { q } from "@/lib/db";
import { chipPublicKey, confirmWithChip } from "@/lib/payments";

// CHIP success callback. Signature is checked, then the purchase is re-read
// from CHIP before anything is activated.

export async function POST(req: Request) {
  const raw = Buffer.from(await req.arrayBuffer());
  let ref: string | null = null;
  let ok = false;
  let note = "";
  try {
    const key = await chipPublicKey();
    if (!key || !verifyCallback(raw, req.headers.get("x-signature"), key)) {
      note = "bad signature";
    } else {
      const body = JSON.parse(raw.toString()) as { reference?: string };
      ref = body.reference ?? null;
      if (ref && /^[0-9a-f-]{36}$/.test(ref)) {
        const status = await confirmWithChip(ref);
        ok = status === "paid";
        note = status;
      } else note = "no reference";
    }
  } catch (e) {
    note = e instanceof Error ? e.message.slice(0, 200) : "error";
    console.error("CHIP callback failed", e);
  }
  await q("insert into webhook_log (source, ref, ok, note) values ('chip', $1, $2, $3)", [ref, ok, note]).catch(() => {});
  return NextResponse.json({ ok }, { status: note === "bad signature" ? 401 : 200 });
}
