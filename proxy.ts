import { NextResponse, type NextRequest } from "next/server";

// Signed-out visitors to /dashboard or /admin go to login and come back to the
// exact page (including ?plan=…). The session itself is verified in the pages.

export function proxy(req: NextRequest) {
  if (!req.cookies.get("es_session")) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(req.nextUrl.pathname + req.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/dashboard/:path*", "/admin/:path*"] };
