import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Redirects /staff/* requests without a session cookie to /login. */
export function proxy(request: NextRequest) {
  if (request.cookies.has("session")) {
    return NextResponse.next();
  }
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/staff/:path*"],
};
