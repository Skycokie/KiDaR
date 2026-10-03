import { NextResponse } from "next/server";
import { publishPublicBaseUrl, resolveExperienceRedirect } from "@kidar/core";
import { getMessages } from "@/i18n/get-messages";
import { getRequestLocale } from "@/i18n/get-request-locale";

/**
 * Public consumer entry. No login. No Appwrite. Maps /ar/{slug} to the
 * immutable R2 HTML URL written by page_render.
 */
export async function GET(
  _request: Request,
  { params }: { params: { slug: string } }
) {
  const publicBaseUrl = publishPublicBaseUrl(process.env);
  const result = await resolveExperienceRedirect({
    slug: params.slug,
    publicBaseUrl,
    allowLocalOrigins: /localhost|127\.0\.0\.1/.test(publicBaseUrl ?? "")
  });
  if (!result.ok) {
    return new NextResponse(getMessages(getRequestLocale()).ar.notPublic, { status: 404 });
  }
  return NextResponse.redirect(result.url, 302);
}
