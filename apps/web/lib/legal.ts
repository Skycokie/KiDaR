/** Legal identity of the company operating kidAR. Single source for every legal page. */
export const LEGAL_OPERATOR = {
  name: "Dev Ai EOOD",
  country: "Bulgaria",
  /** Company ID / VAT number as registered. */
  companyId: "BG208553841",
  addressLines: [
    "1 Bogdan Voyvoda St.",
    "Ruse 7002, Ruse Region",
    "Municipality of Ruse",
    "Bulgaria"
  ]
} as const;

/** Bump with every change of the legal texts. ISO date. */
export const LEGAL_LAST_UPDATED = "2026-10-07";

export const LEGAL_DEFAULT_CONTACT_EMAIL = "contact@devaieood.com";

/**
 * Contact address for privacy requests. `LEGAL_CONTACT_EMAIL` overrides the default
 * when the deployment needs a different mailbox.
 */
export function legalContactEmail(): string | null {
  const value = process.env.LEGAL_CONTACT_EMAIL?.trim() || LEGAL_DEFAULT_CONTACT_EMAIL;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? value : null;
}

export const LEGAL_PATHS = {
  privacy: "/privacy",
  terms: "/terms",
  cookies: "/cookies"
} as const;

export type LegalDocumentId = keyof typeof LEGAL_PATHS;
