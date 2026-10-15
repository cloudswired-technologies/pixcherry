import { NextResponse, type NextRequest } from "next/server";
import { RESERVED } from "@/lib/slug";

// 1. Guest host (GUEST_URL, e.g. app.pixcherry.com): /<slug>/… is the guest app
//    (served from /e/<slug>/…), / is "find your event", anything else goes to the main site.
// 2. Main host: old /e/<slug> links move to the guest host.
// 3. Signed-out visitors to /dashboard or /admin go to login and come back to the
//    exact page (including ?plan=…). The session itself is verified in the pages.

const GUEST_URL = process.env.GUEST_URL?.replace(/\/$/, "") ?? null;
const GUEST_HOST = GUEST_URL ? new URL(GUEST_URL).host : null;
const APP_URL = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
const GUEST_PAGE = /^\/([a-z0-9][a-z0-9-]{1,38}[a-z0-9])(\/(?:recap|slideshow|resume|manifest\.webmanifest))?\/?$/;

function rewrite(req: NextRequest, pathname: string) {
  const url = req.nextUrl.clone();
  url.pathname = pathname;
  return NextResponse.rewrite(url);
}

export function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");

  if (GUEST_HOST && host === GUEST_HOST) {
    if (path.startsWith("/api/") || /^\/[^/]+\.(?:png|svg|ico|js|txt|webp)$/.test(path)) return NextResponse.next();
    if (path === "/") return rewrite(req, "/find");
    if (path.startsWith("/e/")) return NextResponse.redirect(`${GUEST_URL}${path.slice(2)}${req.nextUrl.search}`, 308);
    const m = path.match(GUEST_PAGE);
    if (m && !RESERVED.has(m[1])) return rewrite(req, `/e/${m[1]}${m[2] ?? ""}`);
    return NextResponse.redirect(`${APP_URL}${path}${req.nextUrl.search}`, 307);
  }

  if (GUEST_URL && path.startsWith("/e/")) return NextResponse.redirect(`${GUEST_URL}${path.slice(2)}${req.nextUrl.search}`, 308);

  if ((path.startsWith("/dashboard") || path.startsWith("/admin")) && !req.cookies.get("pc_session")) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(path + req.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
