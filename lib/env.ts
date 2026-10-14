// Public URLs. APP_URL = where the app is served; IMG_URL = R2 custom domain
// (or the local dev storage route).

export const APP_URL = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
export const IMG_URL = (process.env.IMG_URL ?? `${APP_URL}/api/dev-storage`).replace(/\/$/, "");
export const APP_NAME = "EventSnap";
export const TZ = "Asia/Kuala_Lumpur";

export function secret(name: "SESSION_SECRET" | "CRON_SECRET") {
  const v = process.env[name];
  if (!v || v.length < 32) {
    if (process.env.NODE_ENV === "production") throw new Error(`${name} must be set (32+ chars)`);
    return `dev-only-${name}-not-for-production-use`;
  }
  return v;
}
