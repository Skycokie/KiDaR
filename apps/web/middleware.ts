import { NextResponse, type NextRequest } from "next/server";
import { LOCALE_COOKIE, LOCALE_HEADER } from "@/i18n/config";
import { resolveLocale, shouldLocalizePath, splitLocalePrefix } from "@/i18n/locale";

const cookieOptions = {
  path: "/",
  sameSite: "lax" as const,
  maxAge: 60 * 60 * 24 * 365,
  httpOnly: true,
  secure: process.env.NODE_ENV === "production"
};

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!shouldLocalizePath(pathname)) {
    return NextResponse.next();
  }

  const split = splitLocalePrefix(pathname);
  const locale = resolveLocale({
    pathLocale: split.locale,
    cookie: request.cookies.get(LOCALE_COOKIE)?.value,
    acceptLanguage: request.headers.get("accept-language")
  });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(LOCALE_HEADER, locale);

  if (split.locale) {
    const url = request.nextUrl.clone();
    url.pathname = split.pathname;
    const response = NextResponse.rewrite(url, { request: { headers: requestHeaders } });
    response.cookies.set(LOCALE_COOKIE, split.locale, cookieOptions);
    return response;
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
