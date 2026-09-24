import type { Metadata } from "next";
import { localeDirection } from "@/i18n/config";
import { getRequestLocale } from "@/i18n/get-request-locale";

export const metadata: Metadata = {
  title: "kidAR Studio",
  description: "Create playful WebAR experiences from children's drawings."
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  const locale = getRequestLocale();
  return (
    <html lang={locale} dir={localeDirection[locale]}>
      <body>{children}</body>
    </html>
  );
}
