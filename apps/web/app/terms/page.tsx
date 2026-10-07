import type { Metadata } from "next";
import { LegalPage, legalMetadata } from "@/components/legal/legal-page";

export function generateMetadata(): Metadata {
  return legalMetadata("terms");
}

export default function TermsPage() {
  return <LegalPage id="terms" />;
}
