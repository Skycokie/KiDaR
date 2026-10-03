import { NextResponse } from "next/server";
import {
  consumerArUrl,
  generateArQrPng,
  publishPublicBaseUrl,
  resolveExperienceRedirect,
  safeExperienceSlug
} from "@kidar/core";
import { getLoggedInUser } from "@/lib/appwrite/client";
import { getProjectForOwner } from "@/lib/appwrite/db";
import { allowLocalAppOrigins } from "@/lib/publish-identity";

type Context = { params: { projectId: string } };

/**
 * Owner-only QR PNG for a published world. Always encodes the public
 * `/ar/{slug}` page — never a model, R2 object, or signed URL.
 * `?download=1` returns it as an attachment.
 */
export async function GET(request: Request, { params }: Context) {
  const user = await getLoggedInUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const project = await getProjectForOwner(params.projectId, user.$id);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) return NextResponse.json({ error: "qr_unavailable" }, { status: 503 });

  const publicBaseUrl = publishPublicBaseUrl(process.env);
  const published = await resolveExperienceRedirect({
    slug: project.slug,
    publicBaseUrl,
    allowLocalOrigins: /localhost|127\.0\.0\.1/.test(publicBaseUrl ?? "")
  });
  if (!published.ok) return NextResponse.json({ error: "not_published" }, { status: 409 });

  const allowLocalOrigins = allowLocalAppOrigins(process.env);
  const experienceUrl = consumerArUrl(appUrl, project.slug, { allowLocalOrigins });
  const png = await generateArQrPng(experienceUrl, { allowLocalOrigins });

  const download = new URL(request.url).searchParams.get("download") === "1";
  const filename = `kidar-${safeExperienceSlug(project.slug)}-qr.png`;
  return new NextResponse(Buffer.from(png), {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, no-store",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`
    }
  });
}
