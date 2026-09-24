"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { localeEndonyms, supportedLocales, type Locale } from "@/i18n/config";
import { localizedPath } from "@/i18n/locale";
import "./locale-switcher.css";

export function LocaleSwitcher({
  locale,
  label
}: {
  locale: Locale;
  label: string;
}) {
  const pathname = usePathname() ?? "/";
  const searchParams = useSearchParams();
  const search = searchParams?.toString() ?? "";

  return (
    <nav className="locale-switcher" aria-label={label}>
      {supportedLocales.map((item) => {
        const current = item === locale;
        return (
          <a
            key={item}
            href={localizedPath(pathname, search, item)}
            hrefLang={item}
            lang={item}
            aria-current={current ? "true" : undefined}
          >
            {localeEndonyms[item]}
          </a>
        );
      })}
    </nav>
  );
}
