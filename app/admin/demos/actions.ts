"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { expireDemoContent, seedDemos } from "@/lib/demo";
import { audit } from "@/lib/settings";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function setupDemos(_state: { error?: string; ok?: string }, _fd: FormData): Promise<{ error?: string; ok?: string }> {
  const admin = await requireAdmin();
  try {
    const r = await seedDemos(admin.id);
    await audit(admin.id, "demo.setup", null, r);
    const made = r.filter((x) => x.created).length;
    const photos = r.reduce((n, x) => n + x.photos, 0);
    revalidatePath("/admin/demos");
    revalidatePath("/demo");
    return { ok: `${r.length} demo albums ready${made ? ` (${made} new)` : ""}${photos ? `, ${photos} sample photos sent to the worker` : ""}.` };
  } catch (e) {
    console.error("demo setup failed", e);
    return { error: `Setup failed: ${(e as Error).message}` };
  }
}

/** Removes everything visitors added to one demo album (or all), right now. */
export async function clearDemo(eventId: string | null) {
  const admin = await requireAdmin();
  const r = await expireDemoContent({ now: true, eventId: eventId ?? undefined });
  await audit(admin.id, "demo.cleared", eventId, r);
  revalidatePath("/admin/demos");
  revalidatePath("/demo");
}
