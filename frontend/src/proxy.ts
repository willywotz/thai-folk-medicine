import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { defaultLocale, hasLocale } from "@/lib/i18n/config";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const segments = pathname.split("/"); // ["", "en", "staff", ...]
  const first = segments[1] ?? "";

  // 1) No locale prefix -> redirect to the default locale.
  if (!hasLocale(first)) {
    const url = request.nextUrl.clone();
    url.pathname = `/${defaultLocale}${pathname === "/" ? "" : pathname}`;
    return NextResponse.redirect(url);
  }

  // 2) Auth guard on the locale-stripped path, keeping the locale prefix.
  const locale = first;
  const rest = "/" + segments.slice(2).join("/"); // "/staff/healers" or "/"
  const hasSession = request.cookies.has("session");

  const redirectTo = (path: string) => {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}${path}`;
    return NextResponse.redirect(url);
  };

  if (rest === "/login") {
    return hasSession ? redirectTo("/staff") : NextResponse.next();
  }
  if (rest === "/staff" || rest.startsWith("/staff/")) {
    return hasSession ? NextResponse.next() : redirectTo("/login");
  }
  return NextResponse.next();
}

export const config = {
  // Run on everything except Next internals, the API, and static files.
  matcher: ["/((?!_next|bff|.*\\..*).*)"],
};
