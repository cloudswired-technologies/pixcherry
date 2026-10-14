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

async function* files(e: Pick<EventRow, "id">) {
  let cursor: { at: Date; id: string } | null = null;
  let n = 0;
  for (;;) {
    const rows: { id: string; ready_at: Date; name: string | null }[] = await q(
      `select p.id, p.ready_at, g.name from photos p left join guests g on g.id = p.guest_id
       where p.event_id = $1 and p.status = 'ready' ${cursor ? "and (p.ready_at, p.id) > ($2, $3)" : ""}
       order by p.ready_at, p.id limit 200`,
      cursor ? [e.id, cursor.at, cursor.id] : [e.id],
    );
    if (!rows.length) return;
    for (const r of rows) {
      const stream = await getObjectStream(photoKeys(e.id, r.id).full);
      if (!stream) continue;
      n++;
      yield { input: stream, name: `${String(n).padStart(4, "0")}-${safe(r.name ?? "guest")}-${r.id.slice(0, 6)}.jpg`, lastModified: r.ready_at };
    }
    const last = rows[rows.length - 1];
    if (cursor && last.id === cursor.id) return; // cursor did not move: never loop
    cursor = { at: last.ready_at, id: last.id };
  }
}

export function albumResponse(e: Pick<EventRow, "id" | "name">) {
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
  const zip = makeZip(files(e));
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
  const filename = `${safe(e.name)}-photos.zip`;
  return new Response(body, {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
