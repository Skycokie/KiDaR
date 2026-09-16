/** Keep in sync with mind stage versioning in the worker. */
export const MIND_PIPELINE_VERSION = "m4.3.0";

/** Pinned MindAR package version used by the offline compiler. */
export const MIND_AR_PACKAGE_VERSION = "1.2.5";

export const MIND_ARTIFACT_KIND = "targets.mind";

/** Static OfflineCompiler settings that affect input hashing / reproducibility. */
export const MIND_COMPILER_SETTINGS = {
  engine: "offline-compiler-cpu",
  exportFormat: "msgpack",
  exportVersion: 2,
  targetCount: 1
} as const;

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export class MindCompileError extends Error {
  readonly retryable: boolean;
  readonly code: string;

  constructor(message: string, options: { retryable: boolean; code: string }) {
    super(message);
    this.name = "MindCompileError";
    this.retryable = options.retryable;
    this.code = options.code;
  }
}

export function assertMindCompileInputs(input: {
  sourceBytes?: Uint8Array | null;
  sourceFileId?: string | null;
  projectId?: string | null;
  inputHash?: string | null;
}): void {
  if (!input.projectId) {
    throw new MindCompileError("projectId is required for mind_compile", {
      retryable: false,
      code: "MISSING_PROJECT"
    });
  }
  if (!input.inputHash) {
    throw new MindCompileError("inputHash is required for mind_compile", {
      retryable: false,
      code: "MISSING_INPUT_HASH"
    });
  }
  if (!input.sourceFileId) {
    throw new MindCompileError("Source drawing file id is required", {
      retryable: false,
      code: "MISSING_SOURCE"
    });
  }
  if (!input.sourceBytes || input.sourceBytes.byteLength === 0) {
    throw new MindCompileError("Source drawing bytes are empty or missing", {
      retryable: false,
      code: "INVALID_SOURCE"
    });
  }
}

/**
 * Detect JPEG/PNG from magic bytes. Other types are rejected before compile.
 */
export function detectSupportedSourceImageMime(
  bytes: Uint8Array
): "image/jpeg" | "image/png" | null {
  if (bytes.byteLength >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.byteLength >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  return null;
}

export function assertSupportedSourceImage(bytes: Uint8Array): "image/jpeg" | "image/png" {
  const mime = detectSupportedSourceImageMime(bytes);
  if (!mime) {
    throw new MindCompileError("Unsupported source image type; expected JPEG or PNG", {
      retryable: false,
      code: "UNSUPPORTED_SOURCE_TYPE"
    });
  }
  return mime;
}

export interface MindCompileInputParts {
  sourceChecksum: string;
  mindArVersion?: string;
  pipelineVersion?: string;
  compilerSettings?: Record<string, JsonValue>;
}

/**
 * Canonical document hashed for mind_compile input identity.
 * Includes source checksum, MindAR version, pipeline version, and compiler settings.
 * Hash with `computeMindCompileInputHash` from `@kidar/core/hash` (Node crypto).
 */
export function buildMindCompileInputDocument(
  parts: MindCompileInputParts
): Record<string, JsonValue> {
  const settings = parts.compilerSettings ?? { ...MIND_COMPILER_SETTINGS };
  return {
    pipelineVersion: parts.pipelineVersion ?? MIND_PIPELINE_VERSION,
    mindArVersion: parts.mindArVersion ?? MIND_AR_PACKAGE_VERSION,
    sourceChecksum: parts.sourceChecksum,
    compilerSettings: settings
  };
}

/**
 * Deterministic public artifact object key.
 * targets/<projectId>/<inputHash>/targets.mind
 */
export function mindArtifactKey(projectId: string, inputHash: string): string {
  const safeProject = projectId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || "project";
  const safeHash = inputHash.replace(/[^a-f0-9]/gi, "").toLowerCase().slice(0, 64);
  if (!safeHash) {
    throw new MindCompileError("inputHash must be a hex digest for artifact keys", {
      retryable: false,
      code: "INVALID_INPUT_HASH"
    });
  }
  return `targets/${safeProject}/${safeHash}/${MIND_ARTIFACT_KIND}`;
}

export function mindPipelineLabel(): string {
  return `mind@${MIND_PIPELINE_VERSION}+mind-ar@${MIND_AR_PACKAGE_VERSION}`;
}

/** Non-empty .mind buffer check (semantic parse is optional and host-dependent). */
export function assertMindArtifactBytes(bytes: Uint8Array | null | undefined): Uint8Array {
  if (!bytes || bytes.byteLength === 0) {
    throw new MindCompileError("Compiled targets.mind is empty or missing", {
      retryable: false,
      code: "INVALID_MIND"
    });
  }
  return bytes;
}
