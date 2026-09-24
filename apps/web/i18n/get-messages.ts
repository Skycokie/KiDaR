import { defaultLocale, type Locale } from "./config";
import { en } from "./messages/en";
import { ro } from "./messages/ro";
import type { Messages } from "./types";
import { normalizeLocale } from "./locale";

const catalogs: Record<Locale, Messages> = { ro, en };

export function getMessages(locale: string | null | undefined): Messages {
  const resolved = normalizeLocale(locale) ?? defaultLocale;
  return catalogs[resolved];
}
