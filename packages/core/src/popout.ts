import type { SilhouetteStats } from "./sticker-geometry";

/** Keep in sync with hash.ts popoutPipelineVersion (avoid node:crypto in client barrel). */
export const POPOUT_PIPELINE_VERSION = "popout-uv-v2";

export const POPOUT_COVERAGE_REJECT = 0.9;
export const POPOUT_ARTIFACT_KIND = "popout.glb";
/** Shape XY scale used when extruding normalized silhouette points (−0.5…0.5). */
export const POPOUT_SHAPE_SCALE = 2.7;

export class PopoutBuildError extends Error {
  readonly retryable: boolean;
  readonly code: string;

  constructor(message: string, options: { retryable: boolean; code: string }) {
    super(message);
    this.name = "PopoutBuildError";
    this.retryable = options.retryable;
    this.code = options.code;
  }
}

export function assertPopoutInputs(input: {
  sourceBytes?: Uint8Array | null;
  sourceFileId?: string | null;
  projectId?: string | null;
  inputHash?: string | null;
}): void {
  if (!input.projectId) {
    throw new PopoutBuildError("projectId is required for popout_build", {
      retryable: false,
      code: "MISSING_PROJECT"
    });
  }
  if (!input.inputHash) {
    throw new PopoutBuildError("inputHash is required for popout_build", {
      retryable: false,
      code: "MISSING_INPUT_HASH"
    });
  }
  if (!input.sourceFileId) {
    throw new PopoutBuildError("Source drawing file id is required", {
      retryable: false,
      code: "MISSING_SOURCE"
    });
  }
  if (!input.sourceBytes || input.sourceBytes.byteLength === 0) {
    throw new PopoutBuildError("Source drawing bytes are empty or missing", {
      retryable: false,
      code: "INVALID_SOURCE"
    });
  }
}

export function assertPopoutCoverage(stats: SilhouetteStats): void {
  if (stats.coverage >= POPOUT_COVERAGE_REJECT) {
    throw new PopoutBuildError(
      "Foreground mask covers almost the whole image; refusing full-rectangle extrusion",
      { retryable: false, code: "COVERAGE_TOO_HIGH" }
    );
  }
}

/**
 * Deterministic public artifact object key.
 * models/<projectId>/<inputHash>/popout.glb
 */
export function popoutArtifactKey(projectId: string, inputHash: string): string {
  const safeProject = projectId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || "project";
  const safeHash = inputHash.replace(/[^a-f0-9]/gi, "").toLowerCase().slice(0, 64);
  if (!safeHash) {
    throw new PopoutBuildError("inputHash must be a hex digest for artifact keys", {
      retryable: false,
      code: "INVALID_INPUT_HASH"
    });
  }
  return `models/${safeProject}/${safeHash}/${POPOUT_ARTIFACT_KIND}`;
}

export function popoutPipelineLabel(): string {
  return `popout@${POPOUT_PIPELINE_VERSION}`;
}

/**
 * Map extruded shape XY (before geometry.center) onto the full cutout PNG.
 *
 * Silhouette points are image-normalized: nx = px/width - 0.5, ny = 0.5 - py/height
 * (image y=0 is the top). ExtrudeGeometry's default cap UVs are raw XY, which
 * sampled only a corner of the drawing. Convert back to [0,1] image UVs:
 *   u = nx + 0.5 = px/width
 *   v = ny + 0.5 = 1 - py/height
 *
 * v=0 is the image bottom. That matches WebGL/glTF and Three.js CanvasTexture
 * with the default flipY=true. Do not extra-flip the PNG in the GLB writer.
 */
export function popoutCapUv(
  x: number,
  y: number,
  scale = POPOUT_SHAPE_SCALE
): { u: number; v: number } {
  return { u: x / scale + 0.5, v: y / scale + 0.5 };
}
