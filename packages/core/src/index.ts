export type Plan = "free" | "paid";
export {
  alphaMaskFromRgba,
  cleanAlphaMask,
  extractSilhouettePolygons,
  getSilhouetteStats
} from "./sticker-geometry";
export type { AlphaMask, SilhouetteStats, StickerPolygon } from "./sticker-geometry";

export {
  JOB_TYPES,
  JOB_STATUSES,
  JOB_MAX_ATTEMPTS,
  JOB_RETRY_BASE_DELAY_MS,
  JOB_RETRY_MAX_DELAY_MS,
  JOB_LOCK_TTL_MS,
  LAST_ERROR_MAX_LENGTH,
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
  isIdempotentHit
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
  POPOUT_PIPELINE_VERSION,
  PopoutBuildError,
  assertPopoutInputs,
  assertPopoutCoverage,
  popoutArtifactKey,
  popoutPipelineLabel,
  popoutCapUv
} from "./popout";

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
  DEFAULT_AR_INSTRUCTIONS_RO,
  AR_START_BUTTON_LABEL_RO,
  AR_CAMERA_PERMISSION_HINT_RO,
  AR_CAMERA_DENIED_RO,
  AR_WATERMARK_RO,
  ArPageConfigError,
  normalizeArPageConfig,
  buildArPageCsp,
  renderArPage
} from "./templates/ar-page";
export type { ArPageConfig, ArPageVec3, NormalizedArPageConfig } from "./templates/ar-page";

export { generateArQrPng, QrGenerateError } from "./print/qr";
export type { GenerateArQrPngOptions } from "./print/qr";

export {
  generateA4PrintPdf,
  PrintPdfError,
  DEFAULT_PRINT_INSTRUCTION_RO,
  PRINT_WATERMARK_RO,
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
  arePageRenderDependenciesSatisfied,
  publicUrlFromJob,
  assertPublicHtmlBundle,
  assertModelUrlForMode,
  mapSettingsToArPageConfig
} from "./page-render";
export type { PageRenderDependsOn, MapArPageInput } from "./page-render";

export { PublishPlanError, planPublishJobs } from "./publish-plan";
export type { PublishPlanInput, PublishPlan } from "./publish-plan";

export { resolveExperienceRedirect } from "./experience-route";

export type ProjectMode = "popout" | "gallery" | "upload";
export type ProjectStatus = "draft" | "processing" | "ready" | "error";
export type CreatorPreset = "coloring" | "story" | "mission" | "studio";

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
}

export type ProjectSettingsPatch = Partial<
  Omit<ProjectSettings, "offset">
> & {
  offset?: Partial<ProjectSettings["offset"]>;
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

export function mergeSettings(
  current: ProjectSettings,
  patch: ProjectSettingsPatch
): ProjectSettings {
  return {
    ...current,
    ...patch,
    offset: { ...current.offset, ...patch.offset }
  };
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
