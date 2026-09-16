import { describe, expect, it } from "vitest";
import {
  buildPipelineInputDocument,
  computeInputHash,
  stableStringify
} from "./hash";

const settings = {
  title: "Hello",
  theme: "#111111",
  ctaText: "Go",
  ctaUrl: "https://example.com",
  scale: 1,
  offset: { x: 0, y: 1, z: 2 },
  logoPath: "logo_1",
  soundPath: "snd_1",
  uploadModelPath: "model_1"
};

describe("canonical input hashing", () => {
  it("is invariant to object key ordering", () => {
    const a = computeInputHash({
      projectId: "p1",
      mode: "popout",
      source: { fileId: "src_1", checksum: "deadbeef" },
      settings
    });
    const b = computeInputHash({
      projectId: "p1",
      mode: "popout",
      source: { checksum: "deadbeef", fileId: "src_1" },
      settings: {
        offset: { z: 2, x: 0, y: 1 },
        theme: "#111111",
        title: "Hello",
        ctaUrl: "https://example.com",
        ctaText: "Go",
        uploadModelPath: "model_1",
        soundPath: "snd_1",
        logoPath: "logo_1",
        scale: 1
      }
    });
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it("changes when a meaningful artifact input changes", () => {
    const base = computeInputHash({
      projectId: "p1",
      mode: "popout",
      source: { fileId: "src_1", checksum: "deadbeef" },
      settings
    });
    const themeChanged = computeInputHash({
      projectId: "p1",
      mode: "popout",
      source: { fileId: "src_1", checksum: "deadbeef" },
      settings: { ...settings, theme: "#222222" }
    });
    const sourceChanged = computeInputHash({
      projectId: "p1",
      mode: "popout",
      source: { fileId: "src_1", checksum: "cafebabe" },
      settings
    });
    expect(themeChanged).not.toBe(base);
    expect(sourceChanged).not.toBe(base);
  });

  it("stableStringify sorts nested keys", () => {
    expect(stableStringify({ b: 1, a: { d: 2, c: 3 } })).toBe(
      stableStringify({ a: { c: 3, d: 2 }, b: 1 })
    );
  });

  it("buildPipelineInputDocument omits volatile fields", () => {
    const doc = buildPipelineInputDocument({
      projectId: "p1",
      mode: "gallery",
      source: null,
      settings
    });
    expect(doc).not.toHaveProperty("createdAt");
    expect(JSON.stringify(doc)).not.toMatch(/secret|password|signed/i);
  });
});
