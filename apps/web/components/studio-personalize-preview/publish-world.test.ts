import { describe, expect, it, vi } from "vitest";
import {
  canStartPublish,
  publishStatusPath,
  qrDownloadHref,
  shouldPollPublish,
  startPublish,
  type PublishStatusResponse
} from "./publish-world";

const base: PublishStatusResponse = {
  projectId: "p1",
  publishEnabled: true,
  planError: null,
  phase: "idle",
  steps: [],
  publicUrls: { experience: null, pdf: null },
  qrPath: null,
  ready: false
};

describe("publish-world helpers", () => {
  it("builds the status and QR download paths", () => {
    expect(publishStatusPath("a b")).toBe("/api/projects/a%20b/publish");
    expect(qrDownloadHref("/api/projects/p1/qr")).toBe("/api/projects/p1/qr?download=1");
  });

  it("polls only while building", () => {
    expect(shouldPollPublish({ ...base, phase: "building" })).toBe(true);
    expect(shouldPollPublish({ ...base, phase: "ready", ready: true })).toBe(false);
    expect(shouldPollPublish({ ...base, phase: "failed" })).toBe(false);
    expect(shouldPollPublish(null)).toBe(false);
  });

  it("enables Publish only with the flag on, terms ticked, and nothing in flight", () => {
    expect(canStartPublish({ status: base, termsAccepted: true, busy: false })).toBe(true);
    expect(canStartPublish({ status: base, termsAccepted: false, busy: false })).toBe(false);
    expect(canStartPublish({ status: { ...base, publishEnabled: false }, termsAccepted: true, busy: false })).toBe(false);
    expect(canStartPublish({ status: { ...base, phase: "building" }, termsAccepted: true, busy: false })).toBe(false);
    expect(canStartPublish({ status: { ...base, planError: "no source" }, termsAccepted: true, busy: false })).toBe(false);
    expect(canStartPublish({ status: base, termsAccepted: true, busy: true })).toBe(false);
    expect(canStartPublish({ status: null, termsAccepted: true, busy: false })).toBe(false);
  });

  it("sends the consent flag as a strict boolean and surfaces server codes", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ code: "terms" }), { status: 403 })
    );
    await expect(startPublish("p1", false, fetchMock)).resolves.toEqual({ ok: false, code: "terms" });
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)).toEqual({
      projectId: "p1",
      acceptTerms: false
    });
  });
});
