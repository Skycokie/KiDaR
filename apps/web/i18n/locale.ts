import { defaultLocale, type Locale, supportedLocales } from "./config";

const LOCALE_PREFIX = /^\/(ro|en)(?=\/|$)/;

const SECRET_QUERY_KEYS = new Set(["userid", "secret", "token", "code", "session", "magic"]);

export function normalizeLocale(value: string | null | undefined): Locale | null {
  if (!value) return null;
  const base = value.trim().toLowerCase().replace(/_/g, "-").split("-")[0] ?? "";
  if (!base || !/^[a-z]{2}$/.test(base)) return null;
  return (supportedLocales as readonly string[]).includes(base) ? (base as Locale) : null;
}

export function localeFromAcceptLanguage(header: string | null | undefined): Locale | null {
  if (!header) return null;
  const ranked = header
    .split(",")
    .map((part) => {
      const [tagRaw, ...params] = part.trim().split(";");
      const qualityParam = params.find((param) => param.trim().toLowerCase().startsWith("q="));
      const quality = qualityParam ? Number(qualityParam.trim().slice(2)) : 1;
      return { tag: tagRaw?.trim().toLowerCase() ?? "", quality };
    })
    .filter((item) => item.tag && Number.isFinite(item.quality))
    .sort((a, b) => b.quality - a.quality);

  for (const item of ranked) {
    const locale = normalizeLocale(item.tag);
    if (locale) return locale;
  }
  return null;
}

export function resolveLocale(input: {
  pathLocale?: string | null;
  cookie?: string | null;
  acceptLanguage?: string | null;
}): Locale {
  return (
    normalizeLocale(input.pathLocale) ??
    normalizeLocale(input.cookie) ??
    localeFromAcceptLanguage(input.acceptLanguage) ??
    defaultLocale
  );
}

export function splitLocalePrefix(pathname: string): { locale: Locale | null; pathname: string } {
  const match = pathname.match(LOCALE_PREFIX);
  if (!match) return { locale: null, pathname };
  const locale = normalizeLocale(match[1]);
  const rest = pathname.slice(match[0].length);
  const bare = rest.length === 0 ? "/" : rest.startsWith("/") ? rest : `/${rest}`;
  return { locale, pathname: bare };
}

/** Locale prefixes apply to pages only. Auth callback and APIs stay on their existing paths. */
export function shouldLocalizePath(pathname: string): boolean {
  if (pathname.startsWith("/api")) return false;
  if (pathname === "/auth/callback" || pathname.startsWith("/auth/callback/")) return false;
  if (pathname.startsWith("/_next")) return false;
  if (pathname.split("/").pop()?.includes(".")) return false;
  return true;
}

export function localizedPath(pathname: string, search: string, locale: Locale): string {
  const { pathname: bare } = splitLocalePrefix(pathname || "/");
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  for (const key of [...params.keys()]) {
    if (SECRET_QUERY_KEYS.has(key.toLowerCase())) params.delete(key);
  }
  const query = params.toString();
  const path = bare === "/" ? `/${locale}` : `/${locale}${bare}`;
  return query ? `${path}?${query}` : path;
}

/** In-app links keep the existing unprefixed URL for the default locale. */
export function hrefForLocale(pathname: string, locale: Locale): string {
  const { pathname: bare } = splitLocalePrefix(pathname || "/");
  if (locale === defaultLocale) return bare;
  return localizedPath(bare, "", locale);
}
