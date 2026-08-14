import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Auth routing for the staff area:
 * - /staff/* without a session cookie redirects to /login.
 * - /login with a session cookie redirects to /staff (already logged in).
 */
export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has("session");
  const { pathname } = request.nextUrl;

  if (pathname === "/login") {
    if (!hasSession) {
      return NextResponse.next();
    }
    const url = request.nextUrl.clone();
    url.pathname = "/staff";
    return NextResponse.redirect(url);
  }

  if (hasSession) {
    return NextResponse.next();
  }
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/staff/:path*", "/login"],
};
