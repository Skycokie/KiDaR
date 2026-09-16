import { NextResponse } from "next/server";
import { getLoggedInUser } from "@/lib/appwrite/client";
import { getProjectForOwner, updateProjectDocument } from "@/lib/appwrite/db";
import { createSignedSourceUrl, uploadSourceDrawing } from "@/lib/appwrite/storage";

type Context = { params: { projectId: string } };
const allowedTypes = new Set(["image/png", "image/jpeg"]);
const maxBytes = 10 * 1024 * 1024;

export async function POST(request: Request, { params }: Context) {
  const user = await getLoggedInUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const project = await getProjectForOwner(params.projectId, user.$id);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Image file is required" }, { status: 400 });
  if (!allowedTypes.has(file.type)) {
    return NextResponse.json({ error: "Only PNG and JPG images are supported" }, { status: 415 });
  }
  if (file.size > maxBytes) return NextResponse.json({ error: "Image must be 10 MB or smaller" }, { status: 413 });

  try {
    const fileId = await uploadSourceDrawing(user.$id, params.projectId, file);
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
