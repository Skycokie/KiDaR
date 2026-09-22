import { describe, expect, it } from "vitest";
import {
  computeInputHash,
  computeMindCompileInputHash,
  computePageRenderInputHash,
  computePopoutInputHash,
  jobInputHashForType
} from "./hash";
import { mapSettingsToArPageConfig } from "./page-render";
import { resolveEffectiveArTransform } from "./start-transform";
import type { ProjectSettings } from "./index";

const baseSettings = (): ProjectSettings => ({
  title: "Povestea mea",
  theme: "#5b4fe0",
  scale: 1.25,
  offset: { x: 0.1, y: 0, z: -0.2 }
});

const modelUrl = "https://cdn.example.com/models/p/abc/popout.glb";
const targetUrl = "https://cdn.example.com/targets/p/abc/targets.mind";

describe("resolveEffectiveArTransform", () => {
  it("falls back to offset/scale and MindAR z:180 when scene is absent", () => {
    expect(resolveEffectiveArTransform(baseSettings())).toEqual({
      position: { x: 0.1, y: 0, z: -0.2 },
      rotation: { x: 0, y: 0, z: 180 },
      scale: 1.25
    });
  });

  it("uses a complete valid startTransform including custom rotation.z", () => {
    const settings: ProjectSettings = {
      ...baseSettings(),
      scene: {
        startTransform: {
          rotation: { x: 8, y: -32, z: 175 },
          position: { x: 0.2, y: -0.1, z: 0.4 },
          scale: 1.4
        }
      }
    };
    expect(resolveEffectiveArTransform(settings)).toEqual({
      position: { x: 0.2, y: -0.1, z: 0.4 },
      rotation: { x: 8, y: -32, z: 175 },
      scale: 1.4
    });
  });

  it("falls back when startTransform is incomplete, non-finite, or out of range", () => {
    const legacy = resolveEffectiveArTransform(baseSettings());
    expect(
      resolveEffectiveArTransform({
        ...baseSettings(),
        scene: { startTransform: { rotation: { x: 8, y: -32, z: 180 } } }
      })
    ).toEqual(legacy);
    expect(
      resolveEffectiveArTransform({
        ...baseSettings(),
        scene: {
          startTransform: {
            rotation: { x: Number.NaN, y: 0, z: 180 },
            position: { x: 0, y: 0, z: 0 },
            scale: 1
          }
        }
      })
    ).toEqual(legacy);
    expect(
      resolveEffectiveArTransform({
        ...baseSettings(),
        scene: {
          startTransform: {
            rotation: { x: 0, y: 0, z: 180 },
            position: { x: 6, y: 0, z: 0 },
            scale: 1
          }
        }
      })
    ).toEqual(legacy);
    expect(
      resolveEffectiveArTransform({
        ...baseSettings(),
        scene: {
          startTransform: {
            rotation: { x: 0, y: 0, z: 180 },
            position: { x: 0, y: 0, z: 0 },
            scale: 0
          }
        }
      })
    ).toEqual(legacy);
  });
});

describe("mapSettingsToArPageConfig startTransform", () => {
  it("keeps legacy AR config without scene", () => {
    const mapped = mapSettingsToArPageConfig({
      settings: baseSettings(),
      modelUrl,
      targetUrl
    });
    expect(mapped.position).toEqual({ x: 0.1, y: 0, z: -0.2 });
    expect(mapped.scale).toBe(1.25);
    expect(mapped.rotation).toEqual({ x: 0, y: 0, z: 180 });
  });

  it("overrides position, scale, and rotation from a valid saved pose", () => {
    const mapped = mapSettingsToArPageConfig({
      settings: {
        ...baseSettings(),
        scene: {
          startTransform: {
            rotation: { x: 12, y: -40, z: 180 },
            position: { x: 0.3, y: 0.1, z: -0.5 },
            scale: 1.1
          }
        }
      },
      modelUrl,
      targetUrl
    });
    expect(mapped.position).toEqual({ x: 0.3, y: 0.1, z: -0.5 });
    expect(mapped.scale).toBe(1.1);
    expect(mapped.rotation).toEqual({ x: 12, y: -40, z: 180 });
  });

  it("preserves an explicit valid rotation.z", () => {
    const mapped = mapSettingsToArPageConfig({
      settings: {
        ...baseSettings(),
        scene: {
          startTransform: {
            rotation: { x: 0, y: 0, z: 90 },
            position: { x: 0, y: 0, z: 0 },
            scale: 1
          }
        }
      },
      modelUrl,
      targetUrl
    });
    expect(mapped.rotation).toEqual({ x: 0, y: 0, z: 90 });
  });

  it("falls back cleanly for malformed scene data without throwing", () => {
    expect(() =>
      mapSettingsToArPageConfig({
        settings: {
          ...baseSettings(),
          scene: {
            startTransform: {
              rotation: { x: 1, y: 2 },
              position: { x: 0, y: 0, z: 0 },
              scale: 1
            }
          }
        },
        modelUrl,
        targetUrl
      })
    ).not.toThrow();
    const mapped = mapSettingsToArPageConfig({
      settings: {
        ...baseSettings(),
        scene: { startTransform: { scale: 2 } }
      },
      modelUrl,
      targetUrl
    });
    expect(mapped.position).toEqual(baseSettings().offset);
    expect(mapped.scale).toBe(1.25);
    expect(mapped.rotation).toEqual({ x: 0, y: 0, z: 180 });
  });
});

describe("page-only startTransform hash identity", () => {
  const source = { fileId: "src_1", checksum: "aa".repeat(32) };
  const settings = baseSettings();

  it("changes page-render identity when the effective pose changes", () => {
    const contentHash = computeInputHash({
      projectId: "p1",
      mode: "popout",
      source,
      settings
    });
    const withLegacy = resolveEffectiveArTransform(settings);
    const withPose = resolveEffectiveArTransform({
      ...settings,
      scene: {
        startTransform: {
          rotation: { x: 8, y: -32, z: 180 },
          position: { x: 0.2, y: 0, z: 0 },
          scale: 1.25
        }
      }
    });
    const pageA = computePageRenderInputHash({
      inputHash: contentHash,
      slug: "demo",
      startTransform: withLegacy
    });
    const pageB = computePageRenderInputHash({
      inputHash: contentHash,
      slug: "demo",
      startTransform: withPose
    });
    expect(pageA).not.toBe(pageB);
    expect(jobInputHashForType("page_render", contentHash, { slug: "demo", startTransform: withPose })).toBe(
      pageB
    );
    expect(jobInputHashForType("popout_build", contentHash)).toBe(contentHash);
    expect(jobInputHashForType("mind_compile", contentHash)).toBe(contentHash);
  });

  it("does not change Pop-out or Mind hashes for pose-only differences", () => {
    const a = computeInputHash({
      projectId: "p1",
      mode: "popout",
      source,
      settings
    });
    const b = computeInputHash({
      projectId: "p1",
      mode: "popout",
      source,
      settings: {
        ...settings,
        scene: {
          startTransform: {
            rotation: { x: 8, y: -32, z: 180 },
            position: settings.offset,
            scale: settings.scale
          }
        }
      }
    });
    expect(a).toBe(b);
    expect(
      computePopoutInputHash({ projectId: "p1", source, theme: settings.theme })
    ).toBe(computePopoutInputHash({ projectId: "p1", source, theme: settings.theme }));
    expect(
      computeMindCompileInputHash({
        sourceChecksum: source.checksum
      })
    ).toBe(
      computeMindCompileInputHash({
        sourceChecksum: source.checksum
      })
    );
  });

  it("still changes content hash when legacy offset/scale change", () => {
    const base = computeInputHash({
      projectId: "p1",
      mode: "popout",
      source,
      settings
    });
    const moved = computeInputHash({
      projectId: "p1",
      mode: "popout",
      source,
      settings: { ...settings, offset: { x: 1, y: 0, z: 0 } }
    });
    const scaled = computeInputHash({
      projectId: "p1",
      mode: "popout",
      source,
      settings: { ...settings, scale: 2 }
    });
    expect(moved).not.toBe(base);
    expect(scaled).not.toBe(base);
  });
});
