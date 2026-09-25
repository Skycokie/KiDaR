import { cookies, headers } from "next/headers";
import { defaultLocale, LOCALE_COOKIE, LOCALE_HEADER, type Locale } from "./config";
import { localeFromAcceptLanguage, normalizeLocale, splitLocalePrefix } from "./locale";

/** Locale for the current request. Explicit path or cookie wins over Accept-Language. */
export function getRequestLocale(): Locale {
  const headerLocale = normalizeLocale(headers().get(LOCALE_HEADER));
  if (headerLocale) return headerLocale;
  const cookieLocale = normalizeLocale(cookies().get(LOCALE_COOKIE)?.value);
  if (cookieLocale) return cookieLocale;
  return localeFromAcceptLanguage(headers().get("accept-language")) ?? defaultLocale;
}

export function getRequestPathLocale(pathname: string): Locale | null {
  return splitLocalePrefix(pathname).locale;
}
