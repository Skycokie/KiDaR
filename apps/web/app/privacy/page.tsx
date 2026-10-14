import type { Metadata } from "next";
import { LegalPage, legalMetadata } from "@/components/legal/legal-page";

export function generateMetadata(): Metadata {
  return legalMetadata("privacy");
}

export default function PrivacyPage() {
  return <LegalPage id="privacy" />;
}
