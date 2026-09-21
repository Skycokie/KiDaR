/**
 * Figurină 3D (Tripo image-to-3D) contracts — Go C.
 * Separate from pop-out extrusion; never reuse popout_build artifacts.
 */

/** Content-addressed pipeline label for public figurine GLBs. */
export const FIGURINE_PIPELINE_VERSION = "figurine-tripo-v1";

export const FIGURINE_ARTIFACT_KIND = "figurine.glb";

export const FIGURINE_PROVIDER = "tripo" as const;

/** One paid Tripo generation active per project at a time. */
export const FIGURINE_MAX_ACTIVE_JOBS = 1;

/** Soft cap on successful figurine assets retained per project (MVP). */
export const FIGURINE_MAX_ASSETS_PER_PROJECT = 3;

/** Reject downloads above this size before public write (50 MiB). */
export const FIGURINE_MAX_GLB_BYTES = 50 * 1024 * 1024;

/** Soft triangle budget for mobile AR. */
export const FIGURINE_MAX_TRIANGLES = 250_000;

/** Soft vertex budget for mobile AR. */
export const FIGURINE_MAX_VERTICES = 500_000;

/** Source image limits (aligned with Tripo image constraints). */
export const FIGURINE_MAX_SOURCE_BYTES = 20 * 1024 * 1024;
export const FIGURINE_MIN_SOURCE_EDGE_PX = 256;

/** Provider poll deadline inside a worker attempt (ms). */
export const FIGURINE_PROVIDER_TIMEOUT_MS = 5 * 60_000;

export type FigurinePhase =
  | "queued"
  | "submitting"
  | "provider_queued"
  | "provider_running"
  | "downloading"
  | "validating"
  | "ready"
  | "failed";

export type FigurineAvailabilityReason =
  | "available"
  | "feature_gated"
  | "config_missing"
  | "source_missing"
  | "source_unsuitable"
  | "active_job"
  | "asset_cap";

export type FigurineSubjectRecord = {
  id: string;
  /** Private Appwrite source file id (never a public URL). */
  sourceFileId: string;
  label?: string;
  status: FigurinePhase;
  progress: number;
  provider?: typeof FIGURINE_PROVIDER;
  providerTaskId?: string;
  jobId?: string;
  modelUrl?: string;
  artifactHash?: string;
  failureCode?: string;
  failureMessage?: string;
};

export class FigurineBuildError extends Error {
  readonly retryable: boolean;
  readonly code: string;

  constructor(message: string, options: { retryable: boolean; code: string }) {
    super(message);
    this.name = "FigurineBuildError";
    this.retryable = options.retryable;
    this.code = options.code;
  }
}

export function figurinePipelineLabel(): string {
  return `figurine@${FIGURINE_PIPELINE_VERSION}`;
}

/**
 * Deterministic public artifact key.
 * models/<projectId>/<inputHash>/figurine.glb
 */
export function figurineArtifactKey(projectId: string, inputHash: string): string {
  const safeProject = projectId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || "project";
  const safeHash = inputHash.replace(/[^a-f0-9]/gi, "").toLowerCase().slice(0, 64);
  if (!safeHash) {
    throw new FigurineBuildError("inputHash must be a hex digest for figurine artifact keys", {
      retryable: false,
      code: "INVALID_INPUT_HASH"
    });
  }
  return `models/${safeProject}/${safeHash}/${FIGURINE_ARTIFACT_KIND}`;
}

export function assertFigurineInputs(input: {
  sourceBytes?: Uint8Array | null;
  sourceFileId?: string | null;
  projectId?: string | null;
  inputHash?: string | null;
}): void {
  if (!input.projectId) {
    throw new FigurineBuildError("projectId is required for figurine_build", {
      retryable: false,
      code: "MISSING_PROJECT"
    });
  }
  if (!input.inputHash) {
    throw new FigurineBuildError("inputHash is required for figurine_build", {
      retryable: false,
      code: "MISSING_INPUT_HASH"
    });
  }
  if (!input.sourceFileId) {
    throw new FigurineBuildError("Isolated source subject file id is required", {
      retryable: false,
      code: "MISSING_SOURCE"
    });
  }
  if (!input.sourceBytes || input.sourceBytes.byteLength === 0) {
    throw new FigurineBuildError("Source subject bytes are empty or missing", {
      retryable: false,
      code: "INVALID_SOURCE"
    });
  }
  if (input.sourceBytes.byteLength > FIGURINE_MAX_SOURCE_BYTES) {
    throw new FigurineBuildError("Source subject exceeds maximum size", {
      retryable: false,
      code: "SOURCE_TOO_LARGE"
    });
  }
}

/** Detect PNG/JPEG magic bytes (MVP subject formats). */
export function detectFigurineImageMime(bytes: Uint8Array): "image/png" | "image/jpeg" | null {
  if (bytes.byteLength >= 8) {
    if (
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47
    ) {
      return "image/png";
    }
  }
  if (bytes.byteLength >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  return null;
}

/**
 * Deterministic unsuitability checks available without semantic segmentation.
 * Multi-subject scenes are not auto-detected beyond optional connected-component count.
 */
export function assertFigurineSubjectSuitable(input: {
  bytes: Uint8Array;
  width?: number;
  height?: number;
  coverage?: number;
  componentCount?: number;
}): void {
  const mime = detectFigurineImageMime(input.bytes);
  if (!mime) {
    throw new FigurineBuildError("Figurine subject must be PNG or JPEG", {
      retryable: false,
      code: "UNSUPPORTED_IMAGE"
    });
  }
  if (
    typeof input.width === "number" &&
    typeof input.height === "number" &&
    (input.width < FIGURINE_MIN_SOURCE_EDGE_PX || input.height < FIGURINE_MIN_SOURCE_EDGE_PX)
  ) {
    throw new FigurineBuildError(
      `Subject must be at least ${FIGURINE_MIN_SOURCE_EDGE_PX}×${FIGURINE_MIN_SOURCE_EDGE_PX}px`,
      { retryable: false, code: "SOURCE_TOO_SMALL" }
    );
  }
  if (typeof input.coverage === "number" && input.coverage <= 0.001) {
    throw new FigurineBuildError("Subject mask appears empty", {
      retryable: false,
      code: "SOURCE_EMPTY"
    });
  }
  if (typeof input.componentCount === "number" && input.componentCount > 1) {
    throw new FigurineBuildError(
      "Pentru Figurină 3D, alege sau decupează un singur personaj, animal ori obiect.",
      { retryable: false, code: "MULTI_SUBJECT" }
    );
  }
}

export function figurineUiReasonMessage(reason: FigurineAvailabilityReason): string {
  switch (reason) {
    case "available":
      return "";
    case "feature_gated":
      return "În curând";
    case "config_missing":
      return "Configurarea 3D nu este disponibilă încă";
    case "source_missing":
    case "source_unsuitable":
      return "Pentru Figurină 3D, alege sau decupează un singur personaj, animal ori obiect.";
    case "active_job":
      return "O generare Figurină 3D este deja în curs pentru acest proiect";
    case "asset_cap":
      return "Ai atins limita de figurine pentru acest proiect";
    default:
      return "Figurină 3D nu este disponibilă";
  }
}

export function countReadyFigurineAssets(subjects: FigurineSubjectRecord[] | undefined): number {
  if (!subjects?.length) return 0;
  return subjects.filter((s) => s.status === "ready" && Boolean(s.modelUrl)).length;
}

export function hasActiveFigurineSubject(subjects: FigurineSubjectRecord[] | undefined): boolean {
  if (!subjects?.length) return false;
  return subjects.some(
    (s) =>
      s.status === "queued" ||
      s.status === "submitting" ||
      s.status === "provider_queued" ||
      s.status === "provider_running" ||
      s.status === "downloading" ||
      s.status === "validating"
  );
}

export function resolveFigurineAvailability(input: {
  featureEnabled: boolean;
  tripoConfigured: boolean;
  hasIsolatedSource: boolean;
  sourceSuitable: boolean;
  subjects?: FigurineSubjectRecord[];
}): { available: boolean; reason: FigurineAvailabilityReason; message: string } {
  if (!input.featureEnabled) {
    return {
      available: false,
      reason: "feature_gated",
      message: figurineUiReasonMessage("feature_gated")
    };
  }
  if (!input.tripoConfigured) {
    return {
      available: false,
      reason: "config_missing",
      message: figurineUiReasonMessage("config_missing")
    };
  }
  if (!input.hasIsolatedSource) {
    return {
      available: false,
      reason: "source_missing",
      message: figurineUiReasonMessage("source_missing")
    };
  }
  if (!input.sourceSuitable) {
    return {
      available: false,
      reason: "source_unsuitable",
      message: figurineUiReasonMessage("source_unsuitable")
    };
  }
  if (hasActiveFigurineSubject(input.subjects)) {
    return {
      available: false,
      reason: "active_job",
      message: figurineUiReasonMessage("active_job")
    };
  }
  if (countReadyFigurineAssets(input.subjects) >= FIGURINE_MAX_ASSETS_PER_PROJECT) {
    return {
      available: false,
      reason: "asset_cap",
      message: figurineUiReasonMessage("asset_cap")
    };
  }
  return { available: true, reason: "available", message: "" };
}

/** Map job status + result.phase to a safe UI progress label. */
export function figurineProgressLabel(phase: FigurinePhase | string | undefined): string {
  switch (phase) {
    case "queued":
    case "submitting":
      return "În pregătire";
    case "provider_queued":
    case "provider_running":
      return "Modelăm figurina";
    case "downloading":
    case "validating":
      return "Verificăm modelul";
    case "ready":
      return "Gata";
    case "failed":
      return "Nu am reușit să generăm figurina";
    default:
      return "În pregătire";
  }
}

export const FIGURINE_DISCLOSURE_RO =
  "Modelul 3D este generat dintr-o singură imagine. Detaliile nevăzute, inclusiv spatele, sunt interpretate.";
