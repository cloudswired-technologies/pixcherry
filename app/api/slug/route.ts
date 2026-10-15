import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { slugTaken } from "@/lib/events";
import { rateLimit } from "@/lib/rate-limit";
import { slugProblem } from "@/lib/slug";

// Live "is this event link free?" check for the create/edit forms.

export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!(await rateLimit("slug-check", 120, 60_000, user.id))) return NextResponse.json({ error: "Slow down." }, { status: 429 });
  const u = new URL(req.url);
  const s = (u.searchParams.get("s") ?? "").trim().toLowerCase();
  const event = u.searchParams.get("event");
  const problem = slugProblem(s);
  if (problem) return NextResponse.json({ ok: false, error: problem });
  const taken = await slugTaken(s, event && /^[0-9a-f-]{36}$/.test(event) ? event : undefined);
  return NextResponse.json(taken ? { ok: false, error: "Already taken. Try adding the date or a word." } : { ok: true });
}
