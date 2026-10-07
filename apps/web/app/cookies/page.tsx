import type { Metadata } from "next";
import { LegalPage, legalMetadata } from "@/components/legal/legal-page";

export function generateMetadata(): Metadata {
  return legalMetadata("cookies");
}

export default function CookiesPage() {
  return <LegalPage id="cookies" />;
}
