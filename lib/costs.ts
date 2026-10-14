// Rough running-cost estimates shown in the admin. Cloudflare R2 standard
// storage: USD 0.015 per GB-month (egress free). Update if the price changes.

export const R2_USD_PER_GB_MONTH = 0.015;
export const USD_TO_MYR = Number(process.env.USD_TO_MYR ?? 4.4);

export function storageCostMyr(bytes: number, months = 1) {
  const gb = bytes / 1024 ** 3;
  const rm = gb * R2_USD_PER_GB_MONTH * months * USD_TO_MYR;
  return rm < 0.01 ? "< RM0.01" : `RM${rm.toFixed(2)}`;
}

/** Typical stored bytes per photo (full + md + sm) when we have no real data yet. */
export function typicalPhotoBytes(maxPx: number | null) {
  if (!maxPx) return 4_500_000;
  if (maxPx <= 2048) return 1_000_000;
  if (maxPx <= 3000) return 1_800_000;
  return 3_000_000;
}
