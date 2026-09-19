/**
 * Creator publish planning (M4.4b). Pure — no I/O.
 */

import type { JobType } from "./jobs";
import { pageRenderDependsOn, requiredJobsForMode, type PageRenderDependsOn } from "./page-render";
import { assertPublicAbsoluteUrl, PublicUrlError } from "./public-url";

export class PublishPlanError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(message: string, code: string, status = 400) {
    super(message);
    this.name = "PublishPlanError";
    this.code = code;
    this.status = status;
  }
}

export interface PublishPlanInput {
  mode: "popout" | "gallery" | "upload";
  sourceImagePath: string | null;
  galleryModelUrl?: string | null;
  uploadModelUrl?: string | null;
  slug?: string | null;
  allowLocalOrigins?: boolean;
}

export interface PublishPlan {
  jobs: JobType[];
  dependsOn: PageRenderDependsOn;
  publicModelUrl: string | null;
}

export function planPublishJobs(input: PublishPlanInput, inputHash: string): PublishPlan {
  if (!input.sourceImagePath) {
    throw new PublishPlanError("A source drawing is required before publishing.", "MISSING_SOURCE");
  }
  if (!input.slug?.trim()) {
    throw new PublishPlanError("Project slug is required before publishing.", "MISSING_SLUG");
  }

  let publicModelUrl: string | null = null;
  if (input.mode === "gallery") {
    try {
      publicModelUrl = assertPublicAbsoluteUrl(input.galleryModelUrl ?? "", {
        allowLocalOrigins: input.allowLocalOrigins,
        label: "galleryModelUrl"
      }).href;
    } catch (error) {
      const message =
        error instanceof PublicUrlError
          ? error.message
          : "Gallery mode needs a public HTTPS figurine URL before publishing.";
      throw new PublishPlanError(message, "INVALID_GALLERY_MODEL");
    }
  } else if (input.mode === "upload") {
    try {
      publicModelUrl = assertPublicAbsoluteUrl(input.uploadModelUrl ?? "", {
        allowLocalOrigins: input.allowLocalOrigins,
        label: "uploadModelUrl"
      }).href;
    } catch {
      throw new PublishPlanError(
        "Upload mode can only publish when the model is already a public HTTPS URL. Private studio files are not copied to the consumer CDN.",
        "INVALID_UPLOAD_MODEL"
      );
    }
  }

  return {
    jobs: requiredJobsForMode(input.mode),
    dependsOn: pageRenderDependsOn(input.mode, inputHash),
    publicModelUrl
  };
}
