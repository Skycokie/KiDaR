/**
 * Consent records kept in the Appwrite account preferences (no schema change).
 *
 * `parent`: the account holder confirmed they are a parent or legal guardian and agree
 *           that the child's drawing is processed (upload, 3D generation, publishing).
 * `voice`:  the account holder agreed that a recorded or uploaded voice is stored and
 *           played on the public AR page.
 *
 * A record is only valid for the current CONSENT_VERSION. Bump the version whenever the
 * privacy policy changes in a way that needs a fresh confirmation.
 */

export const CONSENT_VERSION = "2026-10-07";

export const CONSENT_KINDS = ["parent", "voice"] as const;
export type ConsentKind = (typeof CONSENT_KINDS)[number];

export type ConsentRecord = { version: string; at: string };
export type ConsentState = Partial<Record<ConsentKind, ConsentRecord>>;

export function isConsentKind(value: unknown): value is ConsentKind {
  return typeof value === "string" && (CONSENT_KINDS as readonly string[]).includes(value);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Reads the consent block out of Appwrite prefs. Anything malformed counts as "no consent". */
export function readConsent(prefs: unknown): ConsentState {
  const block = asRecord(asRecord(prefs)?.consent);
  if (!block) return {};
  const state: ConsentState = {};
  for (const kind of CONSENT_KINDS) {
    const entry = asRecord(block[kind]);
    if (entry && typeof entry.version === "string" && typeof entry.at === "string") {
      state[kind] = { version: entry.version, at: entry.at };
    }
  }
  return state;
}

export function hasValidConsent(prefs: unknown, kind: ConsentKind): boolean {
  return readConsent(prefs)[kind]?.version === CONSENT_VERSION;
}

/**
 * Returns a full prefs object with the consent recorded. Appwrite replaces prefs as a
 * whole on update, so every unrelated key is carried over.
 */
export function withConsent(
  prefs: unknown,
  kind: ConsentKind,
  now: Date = new Date()
): Record<string, unknown> {
  const base = asRecord(prefs) ?? {};
  return {
    ...base,
    consent: {
      ...readConsent(prefs),
      [kind]: { version: CONSENT_VERSION, at: now.toISOString() }
    }
  };
}

export type ConsentStatus = Record<ConsentKind, boolean>;

export function consentStatus(prefs: unknown): ConsentStatus {
  return {
    parent: hasValidConsent(prefs, "parent"),
    voice: hasValidConsent(prefs, "voice")
  };
}
