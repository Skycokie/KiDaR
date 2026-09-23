export type Plan = "free" | "paid";
export {
  alphaMaskFromRgba,
  cleanAlphaMask,
  extractSilhouettePolygons,
  getSilhouetteStats
} from "./sticker-geometry";
export type { AlphaMask, SilhouetteStats, StickerPolygon } from "./sticker-geometry";
export {
  buildEdgeStripRgba,
  medianRgb,
  normalizedToPixel,
  rgbToHex,
  sampleInwardEdgeColors
} from "./popout-edge-color";
export type { EdgeSampleOptions, Rgb } from "./popout-edge-color";
export {
  POPOUT_DEPTH_LEVELS,
  assignPopoutDepthLayers,
  filterPopoutComponents,
  scorePopoutDepth
} from "./popout-depth";
export type { DepthScoredPolygon } from "./popout-depth";

export {
  JOB_TYPES,
  JOB_STATUSES,
  JOB_MAX_ATTEMPTS,
  JOB_RETRY_BASE_DELAY_MS,
  JOB_RETRY_MAX_DELAY_MS,
  JOB_LOCK_TTL_MS,
  PAGE_RENDER_DEFER_MS,
  LAST_ERROR_MAX_LENGTH,
  JobLockMismatchError,
  isJobType,
  isJobStatus,
  canTransition,
  assertTransition,
  truncateJobError,
  retryDelayMs,
  isTerminalFailure,
  isLockExpired,
  isEligibleToClaim,
  applyJobTransition,
  isIdempotentHit,
  assertJobLockHeld,
  prioritizeClaimCandidates,
  pageRenderDeferralIso,
  selectPageRenderClaimAction
} from "./jobs";
export type { JobType, JobStatus, JobResult, PipelineJob, JobTransition } from "./jobs";

export { PublicStorageConfigError } from "./storage-error";
export {
  resolvePublicStorageConfig,
  createUnimplementedPublicStorage,
  createPublicArtifactStorage
} from "./storage";
export type {
  PublicStorageProviderId,
  PublicArtifactWriteInput,
  PublicArtifactMetadata,
  PublicArtifactStorage,
  R2PublicStorageConfig,
  AppwritePublicStorageConfig,
  PublicStorageConfig,
  PublicStorageEnv
} from "./storage";

export {
  IMMUTABLE_CACHE_CONTROL,
  R2_VERIFY_KEY_PREFIX,
  PUBLIC_ARTIFACT_CONTENT_TYPES,
  PublicObjectKeyError,
  defaultR2ApiEndpoint,
  isR2ApiHostname,
  normalizePublicObjectKey,
  publicArtifactUrl,
  assertR2UrlRoles
} from "./storage-keys";
export type { PublicArtifactContentType } from "./storage-keys";

export { MemoryR2ObjectStore, R2PublicArtifactStorage } from "./r2-adapter";
export type { R2ObjectHead, R2ObjectStore } from "./r2-adapter";

export {
  POPOUT_COVERAGE_REJECT,
  POPOUT_ARTIFACT_KIND,
  POPOUT_SHAPE_SCALE,
  POPOUT_EXTRUDE,
  POPOUT_PIPELINE_VERSION,
  PopoutBuildError,
  assertPopoutInputs,
  assertPopoutCoverage,
  popoutArtifactKey,
  popoutPipelineLabel,
  popoutCapUv
} from "./popout";

export {
  FIGURINE_PIPELINE_VERSION,
  FIGURINE_ARTIFACT_KIND,
  FIGURINE_PROVIDER,
  FIGURINE_MAX_ACTIVE_JOBS,
  FIGURINE_MAX_ASSETS_PER_PROJECT,
  FIGURINE_MAX_GLB_BYTES,
  FIGURINE_MAX_TRIANGLES,
  FIGURINE_MAX_VERTICES,
  FIGURINE_RETOPO_FACE_LIMIT,
  FIGURINE_MAX_SOURCE_BYTES,
  FIGURINE_MIN_SOURCE_EDGE_PX,
  FIGURINE_PROVIDER_TIMEOUT_MS,
  FIGURINE_RETOPO_TIMEOUT_MS,
  FIGURINE_DISCLOSURE_RO,
  FigurineBuildError,
  figurinePipelineLabel,
  figurineArtifactKey,
  assertFigurineInputs,
  detectFigurineImageMime,
  assertFigurineSubjectSuitable,
  figurineUiReasonMessage,
  countReadyFigurineAssets,
  hasActiveFigurineSubject,
  resolveFigurineAvailability,
  figurineProgressLabel
} from "./figurine";
export type {
  FigurinePhase,
  FigurineAvailabilityReason,
  FigurineSubjectRecord
} from "./figurine";

export {
  FIGURE_STAGING_ENVIRONMENT,
  FIGURE_STAGING_BUCKET_NAME,
  FIGURE_STAGING_KEY_PREFIX,
  FIGURE_STAGING_GLB_KIND,
  FIGURE_STAGING_USDZ_KIND,
  FIGURE_STAGING_MAX_USDZ_BYTES,
  FIGURE_STAGING_USDZ_CONTENT_TYPE,
  FIGURE_STAGING_GLB_PRESIGN_TTL_SEC,
  FIGURE_STAGING_USDZ_PRESIGN_TTL_SEC,
  FIGURE_STAGING_SOURCE_PRESIGN_TTL_SEC,
  FigureStagingError,
  figureStagingGlbKey,
  figureStagingUsdzKey,
  assertFigureStagingObjectKey,
  isUsdzBuffer,
  assertUsdzArtifact,
  publicFigureAssetsForUi,
  arEnabledFromAssets,
  assertFigureStagingEnvironment,
  createInitialFigureAssets,
  markFigureAssetsProcessing,
  markFigureAssetsReady,
  markFigureAssetsFailed,
  figureStagingUiMessage,
  figureAssetsReadyKeys
} from "./figure-staging";
export type {
  FigureAssetStatus,
  FigureAssets,
  FigureGenerationJob,
  FigureStagingErrorCode,
  FigureStagingGuardInput
} from "./figure-staging";

export {
  MIND_PIPELINE_VERSION,
  MIND_AR_PACKAGE_VERSION,
  MIND_ARTIFACT_KIND,
  MIND_COMPILER_SETTINGS,
  MindCompileError,
  assertMindCompileInputs,
  detectSupportedSourceImageMime,
  assertSupportedSourceImage,
  buildMindCompileInputDocument,
  mindArtifactKey,
  mindPipelineLabel,
  assertMindArtifactBytes
} from "./mind";
export type { MindCompileInputParts } from "./mind";

export {
  PublicUrlError,
  assertPublicAbsoluteUrl,
  escapeHtml,
  escapeHtmlAttr,
  escapeJsString
} from "./public-url";
export type { PublicUrlOptions } from "./public-url";

export {
  AFRAME_CDN_VERSION,
  AFRAME_SCRIPT_URL,
  MINDAR_AFRAME_SCRIPT_URL,
  AR_PAGE_TEMPLATE_VERSION,
  DEFAULT_AR_INSTRUCTIONS_RO,
  AR_START_BUTTON_LABEL_RO,
  AR_RETRY_BUTTON_LABEL_RO,
  AR_CAMERA_PERMISSION_HINT_RO,
  AR_CAMERA_DENIED_RO,
  AR_WATERMARK_RO,
  AR_RUNTIME_STATES,
  AR_FAILURE_COPY_RO,
  classifyArStartError,
  createArStartGate,
  ArPageConfigError,
  normalizeArPageConfig,
  buildArPageCsp,
  renderArPage
} from "./templates/ar-page";
export type {
  ArPageConfig,
  ArPageVec3,
  NormalizedArPageConfig,
  ArRuntimeState,
  ArFailureKind,
  ArFailureSignal,
  ArStartGate
} from "./templates/ar-page";

export { generateArQrPng, QrGenerateError } from "./print/qr";
export type { GenerateArQrPngOptions } from "./print/qr";

export {
  generateA4PrintPdf,
  PrintPdfError,
  DEFAULT_PRINT_INSTRUCTION_RO,
  PRINT_WATERMARK_RO,
  PRINT_PIPELINE_VERSION,
  toPdfWinAnsiText
} from "./print/pdf";
export type { GenerateA4PrintPdfInput, PrintImageMime } from "./print/pdf";

export {
  PAGE_RENDER_PIPELINE_VERSION,
  PAGE_POINTER_CACHE_CONTROL,
  PAGE_ARTIFACT_FILES,
  PageRenderError,
  safeExperienceSlug,
  pageArtifactKey,
  experiencePointerKey,
  consumerArUrl,
  pageRenderPipelineLabel,
  requiredJobsForMode,
  pageRenderDependsOn,
  parsePageRenderDependsOn,
  resolvePageRenderDependsOn,
  arePageRenderDependenciesSatisfied,
  publicUrlFromJob,
  assertPublicHtmlBundle,
  assertModelUrlForMode,
  mapSettingsToArPageConfig,
  selectClickableCta
} from "./page-render";
export type { PageRenderDependsOn, MapArPageInput } from "./page-render";

export { PublishPlanError, planPublishJobs } from "./publish-plan";
export type { PublishPlanInput, PublishPlan } from "./publish-plan";

export { resolveExperienceRedirect } from "./experience-route";

export {
  resolveEffectiveArTransform,
  pageStartTransformIdentity
} from "./start-transform";
export type { EffectiveArTransform, ArVec3, SettingsForArTransform } from "./start-transform";

export type ProjectMode = "popout" | "gallery" | "upload" | "figurine_3d";
export type ProjectStatus = "draft" | "processing" | "ready" | "error";
export type CreatorPreset = "coloring" | "story" | "mission" | "studio";

/** Euler degrees for the model’s initial AR facing. */
export interface StartVec3 {
  x: number;
  y: number;
  z: number;
}

/**
 * Model start pose for a future AR publish. Not the Studio camera orbit.
 * `rotation.z` stays on the MindAR baseline (180) unless a later publish step changes it.
 */
export interface StartTransform {
  rotation: StartVec3;
  position: StartVec3;
  scale: number;
}

export interface SceneSettings {
  startTransform?: StartTransform;
}

export type StartTransformPatch = {
  rotation?: Partial<StartVec3>;
  position?: Partial<StartVec3>;
  scale?: number;
};

export type SceneSettingsPatch = {
  startTransform?: StartTransformPatch;
};

export interface ProjectSettings {
  title: string;
  theme: string;
  /** Simple Creator intent; does not change the technical pipeline `mode`. */
  preset?: CreatorPreset;
  logoUrl?: string;
  ctaText?: string;
  ctaUrl?: string;
  galleryModelUrl?: string;
  uploadModelUrl?: string;
  uploadModelPath?: string;
  /** Public HTTPS GLB from completed figurine_build (R2); never a source-bucket URL. */
  figurineModelUrl?: string;
  /**
   * Per-subject generation records (MVP: usually one). Mutable generation state
   * lives here + job payload — not browser-only storage.
   */
  figurineSubjects?: import("./figurine").FigurineSubjectRecord[];
  /**
   * Staging-only figure assets for internal Quick Look tests.
   * URLs must only be present when status is ready (see publicFigureAssetsForUi).
   */
  figureAssets?: import("./figure-staging").FigureAssets;
  /** Persisted Tripo task ids for idempotent staging retries. */
  figureStagingTasks?: {
    jobId?: string;
    providerTaskId?: string;
    retopoTaskId?: string;
    convertTaskId?: string;
  };
  logoPath?: string;
  soundPath?: string;
  scale: number;
  offset: { x: number; y: number; z: number };
  soundUrl?: string;
  /** Public consumer URLs written by page_render; not part of inputHash. */
  publicHtmlUrl?: string;
  publicQrUrl?: string;
  publicPdfUrl?: string;
  publicExperienceUrl?: string;
  /** Optional AR start pose. Absent on older projects — no migration. */
  scene?: SceneSettings;
}

export type ProjectSettingsPatch = Partial<
  Omit<ProjectSettings, "offset" | "scene">
> & {
  offset?: Partial<ProjectSettings["offset"]>;
  scene?: SceneSettingsPatch;
};

export interface Project {
  id: string;
  owner: string;
  name: string;
  slug: string;
  mode: ProjectMode;
  sourceImagePath: string | null;
  mindPath: string | null;
  glbPath: string | null;
  status: ProjectStatus;
  settings: ProjectSettings;
}

export const PLAN_QUOTAS: Record<Plan, number> = {
  free: 3,
  paid: 30
};

export function canCreateProject(plan: Plan, projectCount: number): boolean {
  return projectCount < PLAN_QUOTAS[plan];
}

export function canUseWhitelabel(plan: Plan): boolean {
  return plan === "paid";
}

function mergeStartTransform(
  current: StartTransform | undefined,
  patch: StartTransformPatch | undefined
): StartTransform | undefined {
  if (!patch) return current;
  if (!current) return patch as StartTransform;
  return {
    rotation: { ...current.rotation, ...patch.rotation },
    position: { ...current.position, ...patch.position },
    scale: patch.scale ?? current.scale
  };
}

function mergeScene(
  current: SceneSettings | undefined,
  patch: SceneSettingsPatch | undefined
): SceneSettings | undefined {
  if (!patch) return current;
  const startTransform = mergeStartTransform(current?.startTransform, patch.startTransform);
  const scene = {
    ...(current ?? {}),
    ...patch,
    ...(startTransform ? { startTransform } : {})
  } as SceneSettings;
  if (!startTransform) delete scene.startTransform;
  return scene;
}

export function mergeSettings(
  current: ProjectSettings,
  patch: ProjectSettingsPatch
): ProjectSettings {
  const { scene: scenePatch, ...rest } = patch;
  const scene = mergeScene(current.scene, scenePatch);
  return {
    ...current,
    ...rest,
    offset: { ...current.offset, ...patch.offset },
    ...(scene ? { scene } : {})
  };
}

const POSITION_LIMIT = 5;
const SCALE_MAX = 10;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateFiniteAxis(
  value: unknown,
  label: string,
  range?: { min: number; max: number }
): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return `${label} must be a finite number`;
  }
  if (range && (value < range.min || value > range.max)) {
    return `${label} must be between ${range.min} and ${range.max}`;
  }
  return null;
}

function validateVec3Patch(
  value: unknown,
  label: string,
  range?: { min: number; max: number }
): string | null {
  if (!isPlainObject(value)) return `${label} must be an object`;
  for (const axis of ["x", "y", "z"] as const) {
    if (!(axis in value) || value[axis] === undefined) continue;
    const message = validateFiniteAxis(value[axis], `${label}.${axis}`, range);
    if (message) return message;
  }
  return null;
}

/**
 * Runtime check for `settings.scene` on PATCH. `undefined` means the key was omitted.
 * Returns an English error string, or null when the patch is acceptable.
 */
export function validateSceneSettingsPatch(scene: unknown): string | null {
  if (scene === undefined) return null;
  if (!isPlainObject(scene)) return "settings.scene must be an object";
  if (!("startTransform" in scene) || scene.startTransform === undefined) return null;
  const start = scene.startTransform;
  if (!isPlainObject(start)) return "settings.scene.startTransform must be an object";
  if ("rotation" in start && start.rotation !== undefined) {
    const message = validateVec3Patch(start.rotation, "settings.scene.startTransform.rotation");
    if (message) return message;
  } else if ("rotation" in start && start.rotation === null) {
    return "settings.scene.startTransform.rotation must be an object";
  }
  if ("position" in start && start.position !== undefined) {
    const message = validateVec3Patch(start.position, "settings.scene.startTransform.position", {
      min: -POSITION_LIMIT,
      max: POSITION_LIMIT
    });
    if (message) return message;
  } else if ("position" in start && start.position === null) {
    return "settings.scene.startTransform.position must be an object";
  }
  if ("scale" in start && start.scale !== undefined) {
    const message = validateFiniteAxis(start.scale, "settings.scene.startTransform.scale");
    if (message) return message;
    if (typeof start.scale === "number" && (start.scale <= 0 || start.scale > SCALE_MAX)) {
      return "settings.scene.startTransform.scale must be in (0, 10]";
    }
  }
  return null;
}

export function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function generateUniqueSlug(
  name: string,
  slugExists: (slug: string) => Promise<boolean>
): Promise<string> {
  const base = slugify(name) || "project";
  let candidate = base;
  let suffix = 2;

  while (await slugExists(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}
