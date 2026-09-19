/**
 * Public /ar/{slug} mapping lookup against R2 — never Appwrite.
 */

import { assertPublicAbsoluteUrl, PublicUrlError } from "./public-url";
import { publicArtifactUrl } from "./storage-keys";
import { experiencePointerKey, safeExperienceSlug } from "./page-render";

export async function resolveExperienceRedirect(input: {
  slug: string;
  publicBaseUrl: string | undefined;
  fetchImpl?: typeof fetch;
  allowLocalOrigins?: boolean;
}): Promise<{ ok: true; url: string } | { ok: false; status: 404 }> {
  if (!input.publicBaseUrl?.trim()) return { ok: false, status: 404 };
  let slug: string;
  try {
    slug = safeExperienceSlug(input.slug);
  } catch {
    return { ok: false, status: 404 };
  }

  let mappingUrl: string;
  try {
    mappingUrl = publicArtifactUrl(input.publicBaseUrl, experiencePointerKey(slug), {
      allowLocalOrigins: input.allowLocalOrigins
    });
  } catch {
    return { ok: false, status: 404 };
  }

  const fetchImpl = input.fetchImpl ?? fetch;
  try {
    const response = await fetchImpl(mappingUrl, { method: "GET", redirect: "follow" });
    if (!response.ok) return { ok: false, status: 404 };
    const dest = (await response.text()).trim();
    const url = assertPublicAbsoluteUrl(dest, {
      allowLocalOrigins: input.allowLocalOrigins,
      label: "experienceHtmlUrl"
    }).href;
    return { ok: true, url };
  } catch (error) {
    if (error instanceof PublicUrlError) return { ok: false, status: 404 };
    return { ok: false, status: 404 };
  }
}
