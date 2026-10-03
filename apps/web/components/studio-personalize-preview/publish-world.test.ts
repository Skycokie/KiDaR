import { describe, expect, it } from "vitest";
import {
  publishStatusPath,
  shouldPollPublish,
  type PublishStatusResponse
} from "./publish-world";

const base: PublishStatusResponse = {
  projectId: "p1",
  projectStatus: "processing",
  planError: null,
  phase: "building",
  steps: [],
  publicUrls: { html: null, qr: null, pdf: null, experience: null },
  ready: false
};

describe("publish-world helpers", () => {
  it("builds the status path", () => {
    expect(publishStatusPath("abc")).toBe("/api/projects/abc/publish");
  });

  it("polls only while building", () => {
    expect(shouldPollPublish(base)).toBe(true);
    expect(shouldPollPublish({ ...base, phase: "ready", ready: true })).toBe(false);
    expect(shouldPollPublish(null)).toBe(false);
  });
});
