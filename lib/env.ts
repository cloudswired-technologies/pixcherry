// Public URLs. APP_URL = where the app is served; IMG_URL = R2 custom domain
// (or the local dev storage route).

export const APP_URL = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
// Guest pages: GUEST_URL=https://app.pixcherry.com serves /<slug>; without it, /e/<slug> on APP_URL.
export const GUEST_URL = (process.env.GUEST_URL ?? `${APP_URL}/e`).replace(/\/$/, "");
/** "app.pixcherry.com/" — shown in front of the event link in forms. */
export const GUEST_PREFIX = `${GUEST_URL.replace(/^https?:\/\//, "")}/`;
export const GUEST_HOST =process.env.GUEST_URL ? new URL(process.env.GUEST_URL).host : null;
export const IMG_URL = (process.env.IMG_URL ?? `${APP_URL}/api/dev-storage`).replace(/\/$/, "");
export const APP_NAME = "PixCherry";
export const TZ = "Asia/Kuala_Lumpur";

export function secret(name: "SESSION_SECRET" | "CRON_SECRET") {
  const v = process.env[name];
  if (!v || v.length < 32) {
    if (process.env.NODE_ENV === "production") throw new Error(`${name} must be set (32+ chars)`);
    return `dev-only-${name}-not-for-production-use`;
  }
  return v;
}
