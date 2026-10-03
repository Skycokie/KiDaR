import {
  normalizeArDecorList,
  planPublishJobs,
  publishPublicBaseUrl,
  resolveEffectiveArTransform,
  type ProjectMode,
  type ProjectSettings
} from "@kidar/core";
import { computeInputHash, sha256Hex } from "@kidar/core/hash";
import { APPWRITE_SOURCE_BUCKET } from "@/lib/appwrite/config";

type PublishableProject = {
  id: string;
  mode: ProjectMode;
  slug: string;
  source_image_path: string | null;
  settings: ProjectSettings;
};

function sourceRef(sourceImagePath: string | null) {
  if (!sourceImagePath) return null;
  return {
    fileId: sourceImagePath,
    checksum: sha256Hex(`appwrite:${APPWRITE_SOURCE_BUCKET}:${sourceImagePath}`)
  };
}

export function publicOrigin(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

export function allowLocalAppOrigins(env: Record<string, string | undefined>): boolean {
  return /localhost|127\.0\.0\.1/.test(env.NEXT_PUBLIC_APP_URL ?? "");
}

export function publishContentHash(project: PublishableProject): string {
  return computeInputHash({
    projectId: project.id,
    mode: project.mode,
    source: sourceRef(project.source_image_path),
    settings: project.settings
  });
}

/**
 * Page-render identity shared by POST /api/publish and the status route.
 * Both must hash identically or the status can never find the page_render job.
 */
export function pageRenderIdentityFor(
  project: PublishableProject,
  env: Record<string, string | undefined>
) {
  return {
    slug: project.slug,
    publicAppOrigin: publicOrigin(env.NEXT_PUBLIC_APP_URL),
    publicAssetOrigin: publicOrigin(publishPublicBaseUrl(env)),
    showWatermark: true,
    startTransform: resolveEffectiveArTransform(project.settings),
    arAnchorMode:
      project.settings?.scene?.arAnchorMode === "follow" ? ("follow" as const) : ("marker" as const),
    decor: normalizeArDecorList(project.settings?.scene?.decor ?? [])
  };
}

export function planProjectPublish(
  project: PublishableProject,
  contentHash: string,
  env: Record<string, string | undefined>
) {
  return planPublishJobs(
    {
      mode: project.mode,
      sourceImagePath: project.source_image_path,
      galleryModelUrl: project.settings?.galleryModelUrl,
      uploadModelUrl: project.settings?.uploadModelUrl,
      figurineModelUrl: project.settings?.figurineModelUrl,
      slug: project.slug,
      allowLocalOrigins: allowLocalAppOrigins(env)
    },
    contentHash
  );
}
