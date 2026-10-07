import { NextResponse } from "next/server";
import { AR_ROBOTS_META_CONTENT, resolveExperienceRedirect } from "@kidar/core";
import { getMessages } from "@/i18n/get-messages";
import { getRequestLocale } from "@/i18n/get-request-locale";

const ROBOTS_HEADER = AR_ROBOTS_META_CONTENT;

/**
 * Public consumer entry. No login. No Appwrite. Maps /ar/{slug} to the
 * immutable R2 HTML URL written by page_render.
 */
export async function GET(
  _request: Request,
  { params }: { params: { slug: string } }
) {
  const result = await resolveExperienceRedirect({
    slug: params.slug,
    publicBaseUrl: process.env.R2_PUBLIC_BASE_URL,
    allowLocalOrigins: /localhost|127\.0\.0\.1/.test(process.env.R2_PUBLIC_BASE_URL ?? "")
  });
  if (!result.ok) {
    return new NextResponse(getMessages(getRequestLocale()).ar.notPublic, {
      status: 404,
      headers: { "X-Robots-Tag": ROBOTS_HEADER }
    });
  }
  const response = NextResponse.redirect(result.url, 302);
  response.headers.set("X-Robots-Tag", ROBOTS_HEADER);
  return response;
}
