import { describe, expect, it } from "vitest";
import {
  FIGURE_STAGING_BUCKET_NAME,
  assertFigureStagingEnvironment,
  assertFigureStagingObjectKey,
  assertUsdzArtifact,
  createInitialFigureAssets,
  figureAssetsReadyKeys,
  figureStagingGlbKey,
  figureStagingUsdzKey,
  figureStagingUiMessage,
  arEnabledFromAssets,
  markFigureAssetsFailed,
  markFigureAssetsProcessing,
  markFigureAssetsReady,
  publicFigureAssetsForUi
} from "./figure-staging";

describe("figure staging contracts", () => {
  it("builds staging keys that never collide with production figurine paths", () => {
    const glb = figureStagingGlbKey("proj_1", "job_abc");
    const usdz = figureStagingUsdzKey("proj_1", "job_abc");
    expect(glb).toBe("staging/projects/proj_1/figures/job_abc/model.glb");
    expect(usdz).toBe("staging/projects/proj_1/figures/job_abc/model.usdz");
    expect(glb).not.toContain("models/");
    expect(glb).not.toContain("figurine.glb");
  });

  it("rejects malicious object keys", () => {
    expect(() =>
      assertFigureStagingObjectKey("proj_1", "staging/projects/other/figures/j/model.glb", "glb")
    ).toThrow(/prefix/i);
    expect(() =>
      assertFigureStagingObjectKey("proj_1", "staging/projects/proj_1/figures/../x/model.glb", "glb")
    ).toThrow(/invalid/i);
    expect(() =>
      assertFigureStagingObjectKey(
        "proj_1",
        "staging/projects/proj_1/figures/job/model%2fglb",
        "glb"
      )
    ).toThrow();
    expect(() =>
      assertFigureStagingObjectKey("proj_1", "models/proj_1/hash/figurine.glb", "glb")
    ).toThrow(/prefix/i);
    expect(
      assertFigureStagingObjectKey(
        "proj_1",
        "staging/projects/proj_1/figures/job_abc/model.glb",
        "glb"
      )
    ).toBe("staging/projects/proj_1/figures/job_abc/model.glb");
  });

  it("rejects USDZ without ZIP magic", () => {
    expect(() => assertUsdzArtifact(new Uint8Array([1, 2, 3]))).toThrow(/ZIP magic/i);
    expect(() => assertUsdzArtifact(new Uint8Array([0x50, 0x4b, 0x03, 0x04]))).not.toThrow();
  });

  it("UI metadata never exposes keys or URLs", () => {
    const base = createInitialFigureAssets("proj_1", new Date("2026-01-01T00:00:00.000Z"));
    expect(publicFigureAssetsForUi(base)).not.toHaveProperty("glbKey");
    expect(arEnabledFromAssets(base)).toBe(false);

    const processing = markFigureAssetsProcessing(base, new Date("2026-01-01T00:01:00.000Z"));
    expect(figureStagingUiMessage(processing.status)).toBe("Figurina 3D se pregătește");

    const ready = markFigureAssetsReady(
      processing,
      {
        jobId: "job_abc",
        glbKey: figureStagingGlbKey("proj_1", "job_abc"),
        usdzKey: figureStagingUsdzKey("proj_1", "job_abc")
      },
      new Date("2026-01-01T00:02:00.000Z")
    );
    const ui = publicFigureAssetsForUi(ready);
    expect(ui.status).toBe("ready");
    expect(ui).not.toHaveProperty("glbKey");
    expect(ui).not.toHaveProperty("usdzKey");
    expect(ui).not.toHaveProperty("previewGlbUrl");
    expect(figureAssetsReadyKeys(ready)?.glbKey).toContain("model.glb");
    expect(arEnabledFromAssets(ready)).toBe(true);
  });

  it("failed assets keep a short code without keys", () => {
    const base = createInitialFigureAssets("proj_1");
    const failed = markFigureAssetsFailed(base, "TRIPO_REJECTED");
    const ui = publicFigureAssetsForUi(failed);
    expect(ui.status).toBe("failed");
    expect(ui.errorCode).toBe("TRIPO_REJECTED");
    expect(figureAssetsReadyKeys(failed)).toBeNull();
  });

  it("staging guard refuses production Appwrite and wrong buckets", () => {
    expect(FIGURE_STAGING_BUCKET_NAME).toBe("kidar-figures-staging");

    expect(() =>
      assertFigureStagingEnvironment({
        jobEnvironment: "staging",
        r2Bucket: "kidar-public-ar",
        stagingBucket: "kidar-public-ar",
        appwriteProjectId: "staging-proj",
        productionAppwriteProjectId: "prod-proj"
      })
    ).toThrow(/dedicated staging/i);

    expect(() =>
      assertFigureStagingEnvironment({
        jobEnvironment: "staging",
        r2Bucket: "kidar-figures-staging",
        stagingBucket: "kidar-figures-staging",
        appwriteProjectId: "prod-proj",
        productionAppwriteProjectId: "prod-proj"
      })
    ).toThrow(/production Appwrite/i);

    expect(() =>
      assertFigureStagingEnvironment({
        jobEnvironment: "staging",
        r2Bucket: "kidar-figures-staging",
        stagingBucket: "kidar-figures-staging",
        appwriteProjectId: "staging-proj",
        productionAppwriteProjectId: "prod-proj"
      })
    ).not.toThrow();
  });
});
