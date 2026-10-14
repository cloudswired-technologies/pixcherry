import "server-only";
import { mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import { createReadStream, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { Readable } from "node:stream";
import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { APP_URL, IMG_URL } from "@/lib/env";
import { hmac } from "@/lib/crypto";

// Photo storage. "r2" in production (Cloudflare R2, S3 API). "local" keeps
// files in .local-storage/ and serves them through /api/dev-storage, so the
// whole upload flow can be tested without a bucket.
//
// Key layout: ev/<eventId>/in/<photoId>     incoming upload (deleted after processing)
//             ev/<eventId>/p/<photoId>/full.jpg | md.webp | sm.webp
//             ev/<eventId>/cover.webp, ev/<eventId>/logo.webp

export const driver = (process.env.STORAGE_DRIVER ?? (process.env.R2_BUCKET ? "r2" : "local")) as "r2" | "local";
const BUCKET = process.env.R2_BUCKET ?? "";
export const LOCAL_ROOT = resolve(process.env.LOCAL_STORAGE_DIR ?? ".local-storage");

// Production must use R2: the web app and the worker run from different
// folders, so local storage there would silently lose uploads.
function assertUsable() {
  if (driver === "local" && process.env.NODE_ENV === "production" && process.env.ALLOW_LOCAL_STORAGE !== "1") {
    throw new Error("Photo storage is not configured (R2_BUCKET missing)");
  }
}

declare global {
  var __pixcherryS3: S3Client | undefined;
}

function s3() {
  globalThis.__pixcherryS3 ??= new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "", secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "" },
    // R2 rejects the SDK's default CRC32 checksum headers on presigned PUTs.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  return globalThis.__pixcherryS3;
}

export function publicUrl(key: string, version?: string | number) {
  return `${IMG_URL}/${key}${version ? `?v=${version}` : ""}`;
}

export function localPath(key: string) {
  if (!/^[a-z0-9/._-]+$/i.test(key) || key.includes("..")) throw new Error("bad key");
  return join(LOCAL_ROOT, key);
}

export function localPutSignature(key: string, type: string, len: number, exp: number) {
  return hmac(`put:${key}:${type}:${len}:${exp}`);
}

/** URL the browser PUTs the file to. Size and type are part of the signature. */
export async function presignPut(key: string, contentType: string, contentLength: number, expiresIn = 900) {
  assertUsable();
  if (driver === "local") {
    const exp = Math.floor(Date.now() / 1000) + expiresIn;
    const sig = localPutSignature(key, contentType, contentLength, exp);
    return `${APP_URL}/api/dev-storage/${key}?exp=${exp}&len=${contentLength}&type=${encodeURIComponent(contentType)}&sig=${sig}`;
  }
  const cmd = new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType, ContentLength: contentLength });
  return getSignedUrl(s3(), cmd, { expiresIn, signableHeaders: new Set(["content-type", "content-length"]) });
}

export async function putObject(key: string, body: Buffer, contentType: string, cacheControl = "public, max-age=604800, immutable") {
  assertUsable();
  if (driver === "local") {
    const p = localPath(key);
    await mkdir(dirname(p), { recursive: true });
    await writeFile(p, body);
    return;
  }
  await s3().send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType, CacheControl: cacheControl }));
}

/** Web stream of an object, or null when missing. */
export async function getObjectStream(key: string): Promise<ReadableStream<Uint8Array> | null> {
  if (driver === "local") {
    const p = localPath(key);
    if (!existsSync(p)) return null;
    return Readable.toWeb(createReadStream(p)) as ReadableStream<Uint8Array>;
  }
  try {
    const r = await s3().send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    return (r.Body as { transformToWebStream(): ReadableStream<Uint8Array> }).transformToWebStream();
  } catch (e) {
    if ((e as { name?: string }).name === "NoSuchKey") return null;
    throw e;
  }
}

export async function deleteObject(key: string) {
  if (driver === "local") {
    await rm(localPath(key), { force: true });
    return;
  }
  await s3().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

/** Deletes everything under a prefix. Returns the number of objects removed. */
export async function deletePrefix(prefix: string) {
  if (!/^ev\/[0-9a-f-]{36}\/(p\/[0-9a-f-]{36}\/)?$/.test(prefix)) throw new Error(`refusing to delete prefix ${prefix}`);
  if (driver === "local") {
    const p = localPath(prefix);
    if (!existsSync(p)) return 0;
    const n = await countFiles(p);
    await rm(p, { recursive: true, force: true });
    return n;
  }
  let removed = 0;
  let token: string | undefined;
  do {
    const list = await s3().send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix, ContinuationToken: token, MaxKeys: 1000 }));
    const keys = (list.Contents ?? []).map((o) => ({ Key: o.Key! }));
    if (keys.length) {
      await s3().send(new DeleteObjectsCommand({ Bucket: BUCKET, Delete: { Objects: keys, Quiet: true } }));
      removed += keys.length;
    }
    token = list.IsTruncated ? list.NextContinuationToken : undefined;
  } while (token);
  return removed;
}

async function countFiles(dir: string): Promise<number> {
  let n = 0;
  for (const e of await readdir(dir, { withFileTypes: true })) {
    n += e.isDirectory() ? await countFiles(join(dir, e.name)) : 1;
  }
  return n;
}

export async function localSize(key: string) {
  try {
    return (await stat(localPath(key))).size;
  } catch {
    return null;
  }
}

export function photoKeys(eventId: string, photoId: string) {
  const base = `ev/${eventId}/p/${photoId}/`;
  return { incoming: `ev/${eventId}/in/${photoId}`, prefix: base, full: `${base}full.jpg`, md: `${base}md.webp`, sm: `${base}sm.webp` };
}
