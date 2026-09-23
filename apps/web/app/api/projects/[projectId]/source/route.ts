import { NextResponse } from "next/server";
import { FIGURE_MAX_UPLOAD_BYTES, normalizeFigureUpload } from "@kidar/core";
import { getLoggedInUser } from "@/lib/appwrite/client";
import { getProjectForOwner, updateProjectDocument } from "@/lib/appwrite/db";
import { createSignedSourceUrl, uploadSourceDrawing } from "@/lib/appwrite/storage";

type Context = { params: { projectId: string } };

export async function POST(request: Request, { params }: Context) {
  const user = await getLoggedInUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const project = await getProjectForOwner(params.projectId, user.$id);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Image file is required" }, { status: 400 });
  const maxBytes = Math.min(10 * 1024 * 1024, FIGURE_MAX_UPLOAD_BYTES);
  if (file.size > maxBytes) {
    return NextResponse.json({ error: "Image is too large" }, { status: 413 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const normalized = normalizeFigureUpload(bytes);
  if (!normalized.ok) {
    const status = normalized.code === "too_large" ? 413 : 415;
    return NextResponse.json({ error: "Unsupported or invalid image", code: normalized.code }, { status });
  }

  const accepted = new File([Buffer.from(normalized.bytes)], file.name || "drawing", {
    type: normalized.mime
  });

  try {
    const fileId = await uploadSourceDrawing(user.$id, params.projectId, accepted);
    const updatedProject = await updateProjectDocument(params.projectId, {
      source_image_path: fileId
    });
    const sourceUrl = await createSignedSourceUrl(fileId, 60 * 60);
    return NextResponse.json({ project: updatedProject, sourceUrl });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
