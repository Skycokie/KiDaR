import { NextResponse } from "next/server";
import { getLoggedInUser } from "@/lib/appwrite/client";
import { countProjectsForOwner, getProfile, listProjectsForOwner } from "@/lib/appwrite/db";
import { createProjectWithUniqueSlug } from "@/lib/projects";

export async function GET() {
  const user = await getLoggedInUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const projects = await listProjectsForOwner(user.$id);
    return NextResponse.json({ projects });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Failed to list projects";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getLoggedInUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as { name?: string; mode?: "popout" | "gallery" | "upload" };
  const name = body.name?.trim();
  if (!name) return NextResponse.json({ error: "Project name is required" }, { status: 400 });

  try {
    const [used, profile] = await Promise.all([
      countProjectsForOwner(user.$id),
      getProfile(user.$id)
    ]);
    const quota = profile.plan === "paid" ? 30 : 3;
    if (used >= quota) {
      return NextResponse.json(
        { error: "quota_exceeded", message: "Free plan allows 3 projects.", upgrade: true },
        { status: 403 }
      );
    }

    const { data, error } = await createProjectWithUniqueSlug(
      user.$id,
      name,
      body.mode ?? "popout"
    );
    if (error || !data) {
      return NextResponse.json({ error: error?.message ?? "Create failed" }, { status: 500 });
    }
    return NextResponse.json({ project: data }, { status: 201 });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Failed to create project";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
