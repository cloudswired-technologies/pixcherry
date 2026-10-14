import "server-only";
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { secret } from "@/lib/env";

const SLUG_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789"; // no l/o/0/1

/** Random, unguessable id for public URLs (10 chars ≈ 50 bits). */
export function randomSlug(len = 10) {
  let s = "";
  for (let i = 0; i < len; i++) s += SLUG_ALPHABET[randomInt(SLUG_ALPHABET.length)];
  return s;
}

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(s: string) {
  return createHash("sha256").update(s).digest("hex");
}

export function hmac(data: string, key = secret("SESSION_SECRET")) {
  return createHmac("sha256", key).update(data).digest("base64url");
}

export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** `payload.signature`, payload is base64url JSON. */
export function sign(obj: unknown) {
  const p = Buffer.from(JSON.stringify(obj)).toString("base64url");
  return `${p}.${hmac(p)}`;
}

export function unsign<T>(token: string | undefined | null): T | null {
  if (!token || token.length > 2000) return null;
  const i = token.lastIndexOf(".");
  if (i < 1) return null;
  const p = token.slice(0, i);
  if (!safeEqual(token.slice(i + 1), hmac(p))) return null;
  try {
    return JSON.parse(Buffer.from(p, "base64url").toString()) as T;
  } catch {
    return null;
  }
}
