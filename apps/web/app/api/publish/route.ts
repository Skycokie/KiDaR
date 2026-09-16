import { NextResponse } from "next/server";
import { getLoggedInUser } from "@/lib/appwrite/client";
import { createJobDocument, getProjectForOwner, updateProjectDocument } from "@/lib/appwrite/db";

export async function POST(request: Request) {
  const user = await getLoggedInUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as { projectId?: string };
  if (!body.projectId) return NextResponse.json({ error: "projectId is required" }, { status: 400 });

  const project = await getProjectForOwner(body.projectId, user.$id);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  try {
    const job = await createJobDocument({
      project_id: body.projectId,
      step: "popout_build",
      status: "queued",
      payload: { source: "studio" },
      owner: user.$id
    });
    await updateProjectDocument(body.projectId, { status: "processing" });
    return NextResponse.json(
      { job, message: "Publish queued. The worker pipeline will process it." },
      { status: 202 }
    );
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Publish failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
