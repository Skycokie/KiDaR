"use client";

import { createContext, useContext, type ReactNode } from "react";
import { defaultLocale, type Locale } from "@/i18n/config";
import { getMessages } from "@/i18n/get-messages";
import type { Messages } from "@/i18n/types";

const StudioI18nContext = createContext<{ locale: Locale; messages: Messages }>({
  locale: defaultLocale,
  messages: getMessages(defaultLocale)
});

export function StudioI18nProvider({
  locale,
  children
}: {
  locale: Locale;
  children: ReactNode;
}) {
  return (
    <StudioI18nContext.Provider value={{ locale, messages: getMessages(locale) }}>
      {children}
    </StudioI18nContext.Provider>
  );
}

export function useStudioI18n() {
  return useContext(StudioI18nContext);
}
