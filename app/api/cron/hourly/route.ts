import { NextResponse } from "next/server";
import { safeEqual } from "@/lib/crypto";
import { secret } from "@/lib/env";
import { runHourly } from "@/lib/jobs";

// Called hourly by system cron: curl -H "authorization: Bearer $CRON_SECRET" .../api/cron/hourly

export async function POST(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  if (!safeEqual(auth, `Bearer ${secret("CRON_SECRET")}`)) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  try {
    return NextResponse.json(await runHourly());
  } catch (e) {
    console.error("hourly cron failed", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
