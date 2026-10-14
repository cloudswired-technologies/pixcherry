import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { safeEqual } from "@/lib/crypto";
import { driver, localPath, localPutSignature } from "@/lib/storage";

// Stand-in for R2 during local development: presigned PUT + public GET.
// Disabled whenever the real bucket is configured.

const TYPES: Record<string, string> = { jpg: "image/jpeg", webp: "image/webp", png: "image/png" };

type Ctx = { params: Promise<{ key: string[] }> };

export async function GET(_req: Request, { params }: Ctx) {
  if (driver !== "local") return new Response("Not found", { status: 404 });
  const key = (await params).key.join("/");
  try {
    const body = await readFile(localPath(key));
    const ext = key.split(".").pop() ?? "";
    return new Response(new Uint8Array(body), {
      headers: { "content-type": TYPES[ext] ?? "application/octet-stream", "cache-control": "public, max-age=3600", "x-content-type-options": "nosniff" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

export async function PUT(req: Request, { params }: Ctx) {
  if (driver !== "local") return new Response("Not found", { status: 404 });
  const key = (await params).key.join("/");
  const u = new URL(req.url);
  const exp = Number(u.searchParams.get("exp"));
  const len = Number(u.searchParams.get("len"));
  const type = u.searchParams.get("type") ?? "";
  const sig = u.searchParams.get("sig") ?? "";
  if (!exp || exp < Date.now() / 1000 || !safeEqual(sig, localPutSignature(key, type, len, exp))) return new Response("Forbidden", { status: 403 });
  if (req.headers.get("content-type") !== type) return new Response("Wrong content type", { status: 400 });
  const body = Buffer.from(await req.arrayBuffer());
  if (body.length !== len) return new Response("Wrong length", { status: 400 });
  const p = localPath(key);
  await mkdir(dirname(p), { recursive: true });
  await writeFile(p, body);
  return new Response(null, { status: 200 });
}
