// Storage for the worker: same layout and drivers as lib/storage.ts.
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

// One day: deleted photos must drop out of the Cloudflare cache soon after deletion.
const CACHE = "public, max-age=86400";

export function createStorage() {
  const driver = process.env.STORAGE_DRIVER ?? (process.env.R2_BUCKET ? "r2" : "local");
  if (driver === "local" && process.env.NODE_ENV === "production" && process.env.ALLOW_LOCAL_STORAGE !== "1") {
    // Wait for R2 settings instead of reading/writing the wrong folder (systemd restarts us).
    throw new Error("Photo storage is not configured (R2_BUCKET missing)");
  }
  if (driver === "local") {
    const root = resolve(process.env.LOCAL_STORAGE_DIR ?? ".local-storage");
    const p = (key) => {
      if (!/^[a-z0-9/._-]+$/i.test(key) || key.includes("..")) throw new Error("bad key");
      return join(root, key);
    };
    return {
      name: `local (${root})`,
      async get(key) {
        try {
          return await readFile(p(key));
        } catch {
          return null;
        }
      },
      async put(key, body) {
        await mkdir(dirname(p(key)), { recursive: true });
        await writeFile(p(key), body);
      },
      async delete(key) {
        await rm(p(key), { force: true });
      },
    };
  }
  const bucket = process.env.R2_BUCKET;
  const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "", secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "" },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  return {
    name: `r2 (${bucket})`,
    async get(key) {
      try {
        const r = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        return Buffer.from(await r.Body.transformToByteArray());
      } catch (e) {
        if (e.name === "NoSuchKey") return null;
        throw e;
      }
    },
    async put(key, body, contentType) {
      await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType, CacheControl: CACHE }));
    },
    async delete(key) {
      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },
  };
}
