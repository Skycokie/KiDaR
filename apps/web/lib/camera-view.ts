import {
  consumerArUrl,
  generateArQrPng,
  resolveCameraViewModel,
  resolveExperienceRedirect,
  safeExperienceSlug
} from "@kidar/core";

export type CameraViewPlatform = "ios" | "android" | "desktop";

export function cameraViewPlatform(input: {
  userAgent: string;
  platform?: string;
  maxTouchPoints?: number;
}): CameraViewPlatform {
  const ua = input.userAgent || "";
  if (/iPhone|iPad|iPod/.test(ua)) return "ios";
  if (input.platform === "MacIntel" && (input.maxTouchPoints ?? 0) > 1) return "ios";
  if (/Android/.test(ua)) return "android";
  return "desktop";
}

export type CameraViewState =
  | { kind: "not_public" }
  | {
      kind: "ready";
      slug: string;
      arPageHref: string;
      /** Character GLB only; null renders the missing-asset fallback. */
      modelUrl: string | null;
      /** QR of the public /ar/{slug} page for desktop guidance. */
      qrDataUrl: string | null;
    };

/**
 * Public, unauthenticated loader for /ar/{slug}/camera. Uses only the R2
 * pointer (never Appwrite) to confirm the world is published.
 */
export async function loadCameraView(input: {
  slug: string;
  modelParam: string | null | undefined;
  env: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
}): Promise<CameraViewState> {
  let slug: string;
  try {
    slug = safeExperienceSlug(input.slug);
  } catch {
    return { kind: "not_public" };
  }
  const publicBaseUrl = input.env.R2_PUBLIC_BASE_URL;
  const allowLocalAssets = /localhost|127\.0\.0\.1/.test(publicBaseUrl ?? "");
  const published = await resolveExperienceRedirect({
    slug,
    publicBaseUrl,
    allowLocalOrigins: allowLocalAssets,
    fetchImpl: input.fetchImpl
  });
  if (!published.ok) return { kind: "not_public" };

  const model = resolveCameraViewModel({
    modelParam: input.modelParam,
    publicBaseUrl,
    allowLocalOrigins: allowLocalAssets
  });

  let qrDataUrl: string | null = null;
  const appUrl = input.env.NEXT_PUBLIC_APP_URL;
  if (appUrl) {
    const allowLocalApp = /localhost|127\.0\.0\.1/.test(appUrl);
    try {
      const png = await generateArQrPng(consumerArUrl(appUrl, slug, { allowLocalOrigins: allowLocalApp }), {
        allowLocalOrigins: allowLocalApp
      });
      qrDataUrl = `data:image/png;base64,${Buffer.from(png).toString("base64")}`;
    } catch {
      qrDataUrl = null;
    }
  }

  return {
    kind: "ready",
    slug,
    arPageHref: `/ar/${slug}`,
    modelUrl: model.ok ? model.modelUrl : null,
    qrDataUrl
  };
}
