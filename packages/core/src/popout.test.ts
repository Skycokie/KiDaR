import { describe, expect, it } from "vitest";
import {
  POPOUT_COVERAGE_REJECT,
  PopoutBuildError,
  assertPopoutCoverage,
  assertPopoutInputs,
  popoutArtifactKey
} from "./popout";

describe("popout build validation", () => {
  it("requires source bytes, file id, project, and input hash", () => {
    expect(() =>
      assertPopoutInputs({
        projectId: "p1",
        inputHash: "abc",
        sourceFileId: "src",
        sourceBytes: new Uint8Array()
      })
    ).toThrow(PopoutBuildError);

    expect(() =>
      assertPopoutInputs({
        projectId: "p1",
        inputHash: "abc",
        sourceFileId: null,
        sourceBytes: new Uint8Array([1])
      })
    ).toThrow(/Source drawing/);

    expect(() =>
      assertPopoutInputs({
        projectId: "p1",
        inputHash: "a".repeat(64),
        sourceFileId: "src_1",
        sourceBytes: new Uint8Array([1, 2, 3])
      })
    ).not.toThrow();
  });

  it("rejects coverage >= 90% as non-retryable", () => {
    expect(() =>
      assertPopoutCoverage({
        coverage: POPOUT_COVERAGE_REJECT,
        vertexCount: 4,
        bounds: { minX: -0.5, minY: -0.5, maxX: 0.5, maxY: 0.5 }
      })
    ).toThrow(/refusing full-rectangle/);

    try {
      assertPopoutCoverage({
        coverage: 0.95,
        vertexCount: 4,
        bounds: { minX: 0, minY: 0, maxX: 1, maxY: 1 }
      });
    } catch (error) {
      expect(error).toBeInstanceOf(PopoutBuildError);
      expect((error as PopoutBuildError).retryable).toBe(false);
      expect((error as PopoutBuildError).code).toBe("COVERAGE_TOO_HIGH");
    }
  });

  it("builds deterministic artifact keys", () => {
    const a = popoutArtifactKey("proj-1", "deadbeef".repeat(8));
    const b = popoutArtifactKey("proj-1", "deadbeef".repeat(8));
    expect(a).toBe(b);
    expect(a).toBe(`models/proj-1/${"deadbeef".repeat(8)}/popout.glb`);
  });
});
