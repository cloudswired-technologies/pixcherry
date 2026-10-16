import { albumResponse } from "@/lib/album";
import { currentUser } from "@/lib/auth";
import { getManagedEvent } from "@/lib/events";

// The organiser's selected photos as one ZIP (form POST with ids=a,b,c).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return new Response("Unauthorised", { status: 401 });
  const e = await getManagedEvent((await params).id, user);
  if (!e || !e.paid_at || e.purged_at) return new Response("Not found", { status: 404 });
  const fd = await req.formData().catch(() => null);
  const ids = String(fd?.get("ids") ?? "")
    .split(",")
    .filter((s) => /^[0-9a-f-]{36}$/.test(s))
    .slice(0, 5000);
  if (!ids.length) return new Response("Choose at least one photo.", { status: 400 });
  return albumResponse(e, ids);
}
