/** Supported locales. Add a locale here only after a reviewed message file exists. */
export const supportedLocales = ["ro", "en"] as const;

export type Locale = (typeof supportedLocales)[number];

export const defaultLocale: Locale = "ro";

export const LOCALE_COOKIE = "kidar_locale";

export const LOCALE_HEADER = "x-kidar-locale";

/** Both current locales are LTR. RTL is not supported until a reviewed translation exists. */
export const localeDirection: Record<Locale, "ltr" | "rtl"> = {
  ro: "ltr",
  en: "ltr"
};

export const localeEndonyms: Record<Locale, string> = {
  ro: "Română",
  en: "English"
};
