import { describe, expect, it } from "vitest";
import {
  FIGURINE_PIPELINE_VERSION,
  assertFigurineInputs,
  assertFigurineSubjectSuitable,
  detectFigurineImageMime,
  figurineArtifactKey,
  figurineProgressLabel,
  resolveFigurineAvailability
} from "./figurine";

describe("figurine contracts", () => {
  it("builds distinct artifact keys from popout namespace", () => {
    const key = figurineArtifactKey("proj_1", "abc123def");
    expect(key).toBe("models/proj_1/abc123def/figurine.glb");
    expect(key).not.toContain("popout.glb");
    expect(FIGURINE_PIPELINE_VERSION).toBe("figurine-tripo-v2");
  });

  it("detects png/jpeg magic", () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    expect(detectFigurineImageMime(png)).toBe("image/png");
    expect(detectFigurineImageMime(jpeg)).toBe("image/jpeg");
    expect(detectFigurineImageMime(new Uint8Array([1, 2, 3]))).toBeNull();
  });

  it("rejects missing inputs", () => {
    expect(() => assertFigurineInputs({})).toThrow(/projectId/i);
  });

  it("rejects multi-subject component counts", () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(() =>
      assertFigurineSubjectSuitable({ bytes: png, componentCount: 2 })
    ).toThrow(/singur personaj, animal ori obiect/i);
  });

  it("resolves availability reasons without exposing secrets", () => {
    expect(
      resolveFigurineAvailability({
        featureEnabled: true,
        tripoConfigured: false,
        hasIsolatedSource: true,
        sourceSuitable: true
      })
    ).toMatchObject({
      available: false,
      reason: "config_missing",
      message: "Configurarea 3D nu este disponibilă încă"
    });

    expect(
      resolveFigurineAvailability({
        featureEnabled: false,
        tripoConfigured: true,
        hasIsolatedSource: true,
        sourceSuitable: true
      }).message
    ).toBe("În curând");

    expect(
      resolveFigurineAvailability({
        featureEnabled: true,
        tripoConfigured: true,
        hasIsolatedSource: false,
        sourceSuitable: false
      }).message
    ).toMatch(/singur personaj, animal ori obiect/i);
  });

  it("maps progress labels", () => {
    expect(figurineProgressLabel("provider_running")).toBe("Modelăm figurina");
    expect(figurineProgressLabel("retopologizing")).toBe("Optimizăm pentru telefon");
    expect(figurineProgressLabel("ready")).toBe("Gata");
    expect(figurineProgressLabel("failed")).toMatch(/Nu am reușit/);
  });
});
