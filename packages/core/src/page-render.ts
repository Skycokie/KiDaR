/**
 * page_render contracts: immutable public AR bundle keys, settings mapping,
 * and upstream dependency checks (M4.4b).
 *
 * Does not upload, query Appwrite, or serve consumer pages.
 */

import {
  ArPageConfigError,
  normalizeArPageConfig,
  type ArPageConfig,
  type NormalizedArPageConfig
} from "./templates/ar-page";
import { assertPublicAbsoluteUrl, PublicUrlError } from "./public-url";
import type { JobType, PipelineJob } from "./jobs";
import type { HashableProjectSettings } from "./hash";
import { IMMUTABLE_CACHE_CONTROL } from "./storage-keys";

export const PAGE_RENDER_PIPELINE_VERSION = "m4.4b.0";
export const PAGE_POINTER_CACHE_CONTROL = "public, max-age=60";

export const PAGE_ARTIFACT_FILES = {
  html: "index.html",
  qr: "qr.png",
  pdf: "print.pdf",
  sound: "sound.mp3",
  logo: "logo.png"
} as const;

export class PageRenderError extends Error {
  readonly retryable: boolean;
  readonly code: string;

  constructor(message: string, options: { retryable: boolean; code: string }) {
    super(message);
    this.name = "PageRenderError";
    this.retryable = options.retryable;
    this.code = options.code;
  }
}

function safeProjectId(projectId: string): string {
  return projectId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || "project";
}

function safeInputHash(inputHash: string): string {
  const safeHash = inputHash.replace(/[^a-f0-9]/gi, "").toLowerCase().slice(0, 64);
  if (!safeHash) {
    throw new PageRenderError("inputHash must be a hex digest for artifact keys", {
      retryable: false,
      code: "INVALID_INPUT_HASH"
    });
  }
  return safeHash;
}

export function safeExperienceSlug(slug: string): string {
  const normalized = slug
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  if (!normalized) {
    throw new PageRenderError("Experience slug is required", {
      retryable: false,
      code: "INVALID_SLUG"
    });
  }
  return normalized;
}

/** pages/<projectId>/<inputHash>/<file> — immutable, no timestamp. */
export function pageArtifactKey(
  projectId: string,
  inputHash: string,
  file: (typeof PAGE_ARTIFACT_FILES)[keyof typeof PAGE_ARTIFACT_FILES]
): string {
  return `pages/${safeProjectId(projectId)}/${safeInputHash(inputHash)}/${file}`;
}

/** Mutable slug pointer: experiences/<slug>/target.txt */
export function experiencePointerKey(slug: string): string {
  return `experiences/${safeExperienceSlug(slug)}/target.txt`;
}

export function consumerArUrl(appOrigin: string, slug: string, options?: { allowLocalOrigins?: boolean }): string {
  const origin = assertPublicAbsoluteUrl(appOrigin, {
    allowLocalOrigins: options?.allowLocalOrigins,
    label: "appOrigin"
  });
  const path = `/ar/${safeExperienceSlug(slug)}`;
  return `${origin.origin}${path}`;
}

export function pageRenderPipelineLabel(): string {
  return `page_render@${PAGE_RENDER_PIPELINE_VERSION}`;
}

export type PageRenderDependsOn = {
  popout_build?: string;
  mind_compile: string;
};

export function requiredJobsForMode(mode: "popout" | "gallery" | "upload"): JobType[] {
  if (mode === "popout") return ["popout_build", "mind_compile", "page_render"];
  if (mode === "gallery") return ["mind_compile", "page_render"];
  return ["mind_compile", "page_render"];
}

export function pageRenderDependsOn(
  mode: "popout" | "gallery" | "upload",
  inputHash: string
): PageRenderDependsOn {
  if (mode === "popout") {
    return { popout_build: inputHash, mind_compile: inputHash };
  }
  return { mind_compile: inputHash };
}

export function arePageRenderDependenciesSatisfied(
  dependsOn: PageRenderDependsOn,
  jobs: Array<Pick<PipelineJob, "type" | "status" | "inputHash" | "result">>
): boolean {
  const needed: Array<[JobType, string]> = [["mind_compile", dependsOn.mind_compile]];
  if (dependsOn.popout_build) needed.push(["popout_build", dependsOn.popout_build]);
  return needed.every(([type, hash]) =>
    jobs.some(
      (job) =>
        job.type === type &&
        job.inputHash === hash &&
        job.status === "done" &&
        Boolean(job.result && typeof job.result.publicUrl === "string")
    )
  );
}

export function publicUrlFromJob(
  jobs: Array<Pick<PipelineJob, "type" | "status" | "inputHash" | "result">>,
  type: JobType,
  inputHash: string
): string {
  const hit = jobs.find(
    (job) => job.type === type && job.inputHash === inputHash && job.status === "done"
  );
  const url = hit?.result && typeof hit.result.publicUrl === "string" ? hit.result.publicUrl : "";
  if (!url) {
    throw new PageRenderError(`Missing public URL from completed ${type} job`, {
      retryable: true,
      code: "MISSING_UPSTREAM_URL"
    });
  }
  return url;
}

const PRIVATE_HTML_HINTS = [
  "/api/files/",
  "/v1/storage/",
  "source-drawings",
  "x-amz-signature",
  "x-appwrite-jwt"
];

export function assertPublicHtmlBundle(html: string, expected: { modelUrl: string; targetUrl: string }): void {
  const lower = html.toLowerCase();
  for (const hint of PRIVATE_HTML_HINTS) {
    if (lower.includes(hint)) {
      throw new PageRenderError("Public HTML must not include private or signed asset URLs", {
        retryable: false,
        code: "PRIVATE_URL_IN_HTML"
      });
    }
  }
  if (!html.includes(expected.modelUrl) || !html.includes(expected.targetUrl)) {
    throw new PageRenderError("Public HTML must reference the expected public model and target URLs", {
      retryable: false,
      code: "MISSING_PUBLIC_ASSET"
    });
  }
}

export function assertModelUrlForMode(
  mode: "popout" | "gallery" | "upload",
  url: string | null | undefined,
  options?: { allowLocalOrigins?: boolean }
): string {
  if (mode === "popout") {
    if (!url) {
      throw new PageRenderError("Pop-out publish requires the public popout.glb URL", {
        retryable: true,
        code: "MISSING_POPOUT_URL"
      });
    }
  } else if (!url) {
    throw new PageRenderError(
      "Gallery/upload publish requires an existing public HTTPS model URL. Private Appwrite files cannot be copied to the consumer CDN.",
      { retryable: false, code: "MISSING_PUBLIC_MODEL" }
    );
  }
  try {
    return assertPublicAbsoluteUrl(url!, {
      allowLocalOrigins: options?.allowLocalOrigins,
      label: "modelUrl"
    }).href;
  } catch (error) {
    if (error instanceof PublicUrlError) {
      throw new PageRenderError(error.message, { retryable: false, code: error.code });
    }
    throw error;
  }
}

export interface MapArPageInput {
  settings: HashableProjectSettings & { logoUrl?: string; soundUrl?: string };
  modelUrl: string;
  targetUrl: string;
  audioUrl?: string | null;
  logoUrl?: string | null;
  allowLocalOrigins?: boolean;
  showWatermark?: boolean;
}

/**
 * Clickable CTA is all-or-nothing. Mission preset stores ctaText as a hunt
 * hint without a URL; that must not become an `<a>`. The AR template has no
 * separate static-hint slot, so incomplete pairs are omitted rather than
 * rendered. Unsafe URLs are refused later by `normalizeArPageConfig`.
 */
export function selectClickableCta(input: {
  ctaText?: string | null;
  ctaUrl?: string | null;
}): { ctaText?: string; ctaUrl?: string } {
  const ctaText = input.ctaText?.trim() ?? "";
  const ctaUrl = input.ctaUrl?.trim() ?? "";
  if (!ctaText || !ctaUrl) return {};
  return { ctaText, ctaUrl };
}

export function mapSettingsToArPageConfig(input: MapArPageInput): NormalizedArPageConfig {
  const cta = selectClickableCta(input.settings);
  const config: ArPageConfig = {
    title: input.settings.title?.trim() || "Surpriza kidAR",
    theme: input.settings.theme || "#6d5dfc",
    modelUrl: input.modelUrl,
    targetUrl: input.targetUrl,
    logoUrl: input.logoUrl || input.settings.logoUrl,
    ctaText: cta.ctaText,
    ctaUrl: cta.ctaUrl,
    audioUrl: input.audioUrl || input.settings.soundUrl,
    transform: {
      position: input.settings.offset,
      scale: input.settings.scale
    },
    showWatermark: input.showWatermark,
    allowLocalOrigins: input.allowLocalOrigins
  };
  try {
    return normalizeArPageConfig(config);
  } catch (error) {
    if (error instanceof ArPageConfigError) {
      throw new PageRenderError(error.message, { retryable: false, code: error.code });
    }
    throw error;
  }
}

export { IMMUTABLE_CACHE_CONTROL, PAGE_POINTER_CACHE_CONTROL as PAGE_RENDER_POINTER_CACHE };
