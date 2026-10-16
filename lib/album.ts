import "server-only";
import { makeZip } from "client-zip";
import { q } from "@/lib/db";
import type { EventRow } from "@/lib/events";
import { getObjectStream, photoKeys } from "@/lib/storage";

// Full-album ZIP, streamed: one photo is read from storage at a time, nothing
// is buffered, so memory stays flat whatever the album size. Stored, not
// compressed (JPEGs don't shrink). A few downloads may run at once per process.

const MAX_PARALLEL = Number(process.env.ALBUM_MAX_PARALLEL ?? 4);
let running = 0;

function safe(s: string) {
  return s.normalize("NFKD").replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").slice(0, 40) || "guest";
}

async function* files(e: Pick<EventRow, "id">, ids?: string[]) {
  // Wishes first, as a text file the hosts can keep.
  const wishes: { name: string | null; message: string; created_at: Date }[] = await q(
    "select name, message, created_at from wishes where event_id = $1 and not is_hidden order by created_at",
    [e.id],
  );
  if (!ids && wishes.length) {
    const text = wishes
      .map((w) => `${w.name ?? "A guest"} (${new Date(w.created_at).toISOString().slice(0, 16).replace("T", " ")} UTC)\n${w.message}\n`)
      .join("\n");
    yield { input: new TextEncoder().encode(text), name: "wishes.txt", lastModified: new Date() };
  }
  // One folder per guest ("Siti-3f2a/0001.jpg"); the id suffix keeps two Sitis apart.
  let cursor: { at: Date; id: string } | null = null;
  const perGuest = new Map<string, number>();
  // Captions go in captions.txt at the end ("Siti-3f2a/0001.jpg — Best day ever").
  const captions: string[] = [];
  for (;;) {
    const rows: { id: string; ready_at: Date; name: string | null; guest_id: string | null; caption: string | null }[] = await q(
      `select p.id, p.ready_at, g.name, p.guest_id, p.caption from photos p left join guests g on g.id = p.guest_id
       where p.event_id = $1 and p.status = 'ready' and ($2::uuid[] is null or p.id = any($2::uuid[]))
         ${cursor ? "and (p.ready_at, p.id) > ($3, $4)" : ""}
       order by p.ready_at, p.id limit 200`,
      cursor ? [e.id, ids ?? null, cursor.at, cursor.id] : [e.id, ids ?? null],
    );
    if (!rows.length) break;
    for (const r of rows) {
      const stream = await getObjectStream(photoKeys(e.id, r.id).full);
      if (!stream) continue;
      const folder = r.guest_id ? `${safe(r.name ?? "Guest")}-${r.guest_id.slice(0, 4)}` : "Organiser";
      const n = (perGuest.get(folder) ?? 0) + 1;
      perGuest.set(folder, n);
      const name = `${folder}/${String(n).padStart(4, "0")}.jpg`;
      if (r.caption) captions.push(`${name} — ${r.caption} (${r.name ?? "a guest"})`);
      yield { input: stream, name, lastModified: r.ready_at };
    }
    const last = rows[rows.length - 1];
    if (cursor && last.id === cursor.id) break; // cursor did not move: never loop
    cursor = { at: last.ready_at, id: last.id };
  }
  if (captions.length) yield { input: new TextEncoder().encode(captions.join("\n") + "\n"), name: "captions.txt", lastModified: new Date() };
}

/** Whole album, or only the photos in `ids` (organiser's selection). */
export function albumResponse(e: Pick<EventRow, "id" | "name">, ids?: string[]) {
  if (running >= MAX_PARALLEL) {
    return new Response("Many albums are downloading right now. Please try again in a minute.", { status: 429, headers: { "retry-after": "60" } });
  }
  running++;
  let released = false;
  const release = () => {
    if (!released) {
      released = true;
      running--;
    }
  };
  const zip = makeZip(files(e, ids));
  const reader = zip.getReader();
  const body = new ReadableStream<Uint8Array>({
    async pull(ctrl) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          release();
          ctrl.close();
        } else ctrl.enqueue(value);
      } catch (err) {
        release();
        ctrl.error(err);
      }
    },
    cancel(reason) {
      release();
      return reader.cancel(reason);
    },
  });
  const filename = `${safe(e.name)}-${ids ? `${ids.length}-photos` : "photos"}.zip`;
  return new Response(body, {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
