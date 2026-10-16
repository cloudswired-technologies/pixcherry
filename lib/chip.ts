import "server-only";
import { constants, verify } from "node:crypto";

// CHIP Collect API (https://docs.chip-in.asia). Amounts are in sen.
// Each provider uses their own CHIP account: brand id + secret key.

const BASE = process.env.CHIP_API_BASE ?? "https://gate.chip-in.asia/api/v1";

export type ChipCreds = { brandId: string; secretKey: string };

export type ChipPurchase = {
  id: string;
  status: string; // created | paid | error | cancelled | expired | refunded | …
  checkout_url?: string;
  reference?: string;
  purchase?: { total?: number; currency?: string };
  is_test?: boolean;
};

export class ChipError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
  }
}

async function call<T>(creds: Pick<ChipCreds, "secretKey">, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${creds.secretKey}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const text = await res.text();
  if (!res.ok) {
    // Never echo the response body to users; it can contain account details.
    console.error(`CHIP ${init?.method ?? "GET"} ${path} -> ${res.status}: ${text.slice(0, 500)}`);
    throw new ChipError(res.status === 401 || res.status === 403 ? "CHIP rejected the API key." : "CHIP request failed.", res.status);
  }
  return (text ? JSON.parse(text) : null) as T;
}

export function createPurchase(
  creds: ChipCreds,
  input: {
    reference: string;
    productName: string;
    amountCents: number;
    client: { email: string; full_name?: string; phone?: string };
    successRedirect: string;
    failureRedirect: string;
    cancelRedirect: string;
    successCallback: string;
  },
) {
  return call<ChipPurchase>(creds, "/purchases/", {
    method: "POST",
    body: JSON.stringify({
      brand_id: creds.brandId,
      reference: input.reference,
      client: input.client,
      purchase: {
        currency: "MYR",
        products: [{ name: input.productName.slice(0, 256), price: input.amountCents }],
      },
      success_redirect: input.successRedirect,
      failure_redirect: input.failureRedirect,
      cancel_redirect: input.cancelRedirect,
      success_callback: input.successCallback,
    }),
  });
}

export function getPurchase(creds: Pick<ChipCreds, "secretKey">, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ChipError("Invalid purchase id");
  return call<ChipPurchase>(creds, `/purchases/${id}/`);
}

/** Public key used to sign success callbacks (also proves the secret key works). */
export async function getPublicKey(creds: Pick<ChipCreds, "secretKey">) {
  const key = await call<string | { public_key?: string }>(creds, "/public_key/");
  const pem = typeof key === "string" ? key : key?.public_key;
  if (!pem || !pem.includes("BEGIN PUBLIC KEY")) throw new ChipError("CHIP did not return a public key.");
  return pem;
}

/** X-Signature = base64 RSA PKCS#1 v1.5 signature of SHA-256(raw body). */
export function verifyCallback(rawBody: Buffer, signatureB64: string | null, publicKeyPem: string) {
  if (!signatureB64) return false;
  try {
    return verify(
      "sha256",
      rawBody,
      { key: publicKeyPem, padding: constants.RSA_PKCS1_PADDING },
      Buffer.from(signatureB64, "base64"),
    );
  } catch {
    return false;
  }
}

