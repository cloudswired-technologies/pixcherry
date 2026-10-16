import { NextResponse } from "next/server";
import { getEventBySlug } from "@/lib/events";
import { currentGuest, noteGuestAddress } from "@/lib/guests";
import { uploadsOpen } from "@/lib/limits";
import { MAX_FILES_PER_REQUEST, reserveUploads } from "@/lib/photos";
import { rateLimit } from "@/lib/rate-limit";
import { getSetting } from "@/lib/settings";

// Step 1 of an upload: reserve slots and get presigned PUT URLs.

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const e = await getEventBySlug((await params).slug);
  if (!e) return NextResponse.json({ error: "Event not found." }, { status: 404 });
  if (!uploadsOpen(e, e.cfg)) return NextResponse.json({ error: "Uploads for this event are closed." }, { status: 403 });
  const guest = await currentGuest(e.id);
  if (!guest) return NextResponse.json({ error: "Please join the event first.", code: "join" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { files?: { type?: unknown; size?: unknown; mission?: unknown }[] } | null;
  const files = (body?.files ?? []).slice(0, MAX_FILES_PER_REQUEST).map((f) => ({
    type: String(f.type ?? ""),
    size: Number(f.size),
    mission: typeof f.mission === "string" ? f.mission : null,
    tags: (f as { tags?: unknown }).tags,
    caption: (f as { caption?: unknown }).caption,
  }));
  if (!files.length) return NextResponse.json({ error: "No files." }, { status: 400 });

  const perMinute = await getSetting("upload_rate_per_minute");
  // Per phone only: a whole venue can share one Wi-Fi IP, and joining passed the bot check.
  if (!(await rateLimit("upload-guest", Number(perMinute) || 30, 60_000, guest.id, files.length))) {
    return NextResponse.json({ error: "Too many uploads at once. Please wait a minute." }, { status: 429 });
  }

  const r = await reserveUploads(e, guest.id, files);
  // Phones change their IPv6 address now and then: keep the latest, for "one phone, one roll".
  await noteGuestAddress(guest.id).catch(() => {});
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: 409 });
  return NextResponse.json(r);
}
