import { NextResponse } from "next/server";
import { getLoggedInUser, createAdminClient } from "@/lib/appwrite/client";
import { getProjectForOwner } from "@/lib/appwrite/db";
import { APPWRITE_SOURCE_BUCKET } from "@/lib/appwrite/config";
import { isStagingRuntime } from "@/lib/staging-runtime";

type Context = { params: { projectId: string } };

const NO_STORE = {
  "Cache-Control": "no-store",
  Pragma: "no-cache"
};

/**
 * Staging-only: authenticated owner can fetch the project source drawing bytes.
 * Used only as a local recognition reference — never public CDN.
 */
export async function GET(_request: Request, { params }: Context) {
  if (!isStagingRuntime()) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  }

  const user = await getLoggedInUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  }

  const projectId = params.projectId?.trim();
  if (!projectId || projectId.includes("..") || projectId.includes("/") || projectId.includes("%")) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  }

  const project = await getProjectForOwner(projectId, user.$id);
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  }

  const fileId = project.source_image_path?.trim();
  if (!fileId || fileId.includes("..") || fileId.includes("/") || fileId.includes("%")) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  }

  try {
    const { storage } = createAdminClient();
    const bytes = await storage.getFileDownload(APPWRITE_SOURCE_BUCKET, fileId);
    const file = await storage.getFile(APPWRITE_SOURCE_BUCKET, fileId);
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        ...NO_STORE,
        "content-type": file.mimeType || "image/jpeg",
        "x-content-type-options": "nosniff"
      }
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  }
}
