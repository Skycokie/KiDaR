import { describe, expect, it } from "vitest";
import {
  CONSENT_VERSION,
  consentStatus,
  hasValidConsent,
  isConsentKind,
  readConsent,
  withConsent
} from "./consent";

const NOW = new Date("2026-10-07T12:00:00.000Z");

describe("consent records", () => {
  it("treats missing or malformed prefs as no consent", () => {
    for (const prefs of [undefined, null, "x", [], {}, { consent: "yes" }, { consent: { parent: true } }]) {
      expect(hasValidConsent(prefs, "parent")).toBe(false);
      expect(readConsent(prefs)).toEqual({});
    }
  });

  it("records a consent with the current version and timestamp", () => {
    const prefs = withConsent({}, "parent", NOW);
    expect(prefs).toEqual({
      consent: { parent: { version: CONSENT_VERSION, at: NOW.toISOString() } }
    });
    expect(hasValidConsent(prefs, "parent")).toBe(true);
    expect(hasValidConsent(prefs, "voice")).toBe(false);
  });

  it("keeps unrelated prefs and the other consent when recording", () => {
    const first = withConsent({ theme: "dark" }, "parent", NOW);
    const both = withConsent(first, "voice", new Date("2026-10-08T00:00:00.000Z"));
    expect(both.theme).toBe("dark");
    expect(consentStatus(both)).toEqual({ parent: true, voice: true });
    expect(readConsent(both).parent?.at).toBe(NOW.toISOString());
  });

  it("requires a fresh consent when the policy version changes", () => {
    const stale = { consent: { parent: { version: "2020-01-01", at: NOW.toISOString() } } };
    expect(hasValidConsent(stale, "parent")).toBe(false);
    expect(consentStatus(stale)).toEqual({ parent: false, voice: false });
  });

  it("only accepts known consent kinds", () => {
    expect(isConsentKind("parent")).toBe(true);
    expect(isConsentKind("voice")).toBe(true);
    expect(isConsentKind("marketing")).toBe(false);
    expect(isConsentKind(undefined)).toBe(false);
  });
});
