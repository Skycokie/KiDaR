import { describe, expect, it } from "vitest";
import {
  MIND_AR_PACKAGE_VERSION,
  MIND_COMPILER_SETTINGS,
  MIND_PIPELINE_VERSION,
  MindCompileError,
  assertMindCompileInputs,
  assertSupportedSourceImage,
  buildMindCompileInputDocument,
  detectSupportedSourceImageMime,
  mindArtifactKey,
  mindPipelineLabel
} from "./mind";
import { computeMindCompileInputHash, sha256Hex } from "./hash";

const jpegHeader = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const pngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe("mind compile validation", () => {
  it("requires source bytes, file id, project, and input hash", () => {
    expect(() =>
      assertMindCompileInputs({
        projectId: "p1",
        inputHash: "abc",
        sourceFileId: "src",
        sourceBytes: new Uint8Array()
      })
    ).toThrow(MindCompileError);

    expect(() =>
      assertMindCompileInputs({
        projectId: "p1",
        inputHash: "abc",
        sourceFileId: null,
        sourceBytes: new Uint8Array([1])
      })
    ).toThrow(/Source drawing/);

    expect(() =>
      assertMindCompileInputs({
        projectId: "p1",
        inputHash: "a".repeat(64),
        sourceFileId: "src_1",
        sourceBytes: new Uint8Array([1, 2, 3])
      })
    ).not.toThrow();
  });

  it("accepts JPEG/PNG and rejects other types as non-retryable", () => {
    expect(detectSupportedSourceImageMime(jpegHeader)).toBe("image/jpeg");
    expect(detectSupportedSourceImageMime(pngHeader)).toBe("image/png");
    expect(assertSupportedSourceImage(jpegHeader)).toBe("image/jpeg");

    try {
      assertSupportedSourceImage(new Uint8Array([0x00, 0x01, 0x02]));
      throw new Error("expected throw");
    } catch (error) {
      expect(error).toBeInstanceOf(MindCompileError);
      expect((error as MindCompileError).retryable).toBe(false);
      expect((error as MindCompileError).code).toBe("UNSUPPORTED_SOURCE_TYPE");
    }
  });

  it("builds deterministic artifact keys", () => {
    const a = mindArtifactKey("proj-1", "deadbeef".repeat(8));
    const b = mindArtifactKey("proj-1", "deadbeef".repeat(8));
    expect(a).toBe(b);
    expect(a).toBe(`targets/proj-1/${"deadbeef".repeat(8)}/targets.mind`);
  });
});

describe("mind compile input hashing", () => {
  it("is stable for equivalent configuration ordering", () => {
    const checksum = sha256Hex(jpegHeader);
    const a = computeMindCompileInputHash({
      sourceChecksum: checksum,
      compilerSettings: {
        exportVersion: MIND_COMPILER_SETTINGS.exportVersion,
        engine: MIND_COMPILER_SETTINGS.engine,
        targetCount: MIND_COMPILER_SETTINGS.targetCount,
        exportFormat: MIND_COMPILER_SETTINGS.exportFormat
      }
    });
    const b = computeMindCompileInputHash({
      sourceChecksum: checksum,
      compilerSettings: {
        engine: MIND_COMPILER_SETTINGS.engine,
        exportFormat: MIND_COMPILER_SETTINGS.exportFormat,
        exportVersion: MIND_COMPILER_SETTINGS.exportVersion,
        targetCount: MIND_COMPILER_SETTINGS.targetCount
      }
    });
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it("changes when source checksum, mind-ar version, or settings change", () => {
    const base = computeMindCompileInputHash({
      sourceChecksum: "aa".repeat(32)
    });
    const sourceChanged = computeMindCompileInputHash({
      sourceChecksum: "bb".repeat(32)
    });
    const versionChanged = computeMindCompileInputHash({
      sourceChecksum: "aa".repeat(32),
      mindArVersion: "9.9.9"
    });
    const settingsChanged = computeMindCompileInputHash({
      sourceChecksum: "aa".repeat(32),
      compilerSettings: { ...MIND_COMPILER_SETTINGS, targetCount: 2 }
    });
    expect(sourceChanged).not.toBe(base);
    expect(versionChanged).not.toBe(base);
    expect(settingsChanged).not.toBe(base);
  });

  it("embeds pipeline and mind-ar versions in the canonical document", () => {
    const doc = buildMindCompileInputDocument({
      sourceChecksum: "cc".repeat(32)
    });
    expect(doc.pipelineVersion).toBe(MIND_PIPELINE_VERSION);
    expect(doc.mindArVersion).toBe(MIND_AR_PACKAGE_VERSION);
    expect(mindPipelineLabel()).toContain(MIND_PIPELINE_VERSION);
    expect(mindPipelineLabel()).toContain(MIND_AR_PACKAGE_VERSION);
  });
});
