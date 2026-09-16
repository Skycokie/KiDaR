import { generateUniqueSlug, type ProjectMode, type ProjectSettings } from "@kidar/core";
import { createProjectDocument, slugExists } from "@/lib/appwrite/db";

export const DEFAULT_SETTINGS: ProjectSettings = {
  title: "",
  theme: "#6d5dfc",
  scale: 1,
  offset: { x: 0, y: 0, z: 0 }
};

export async function createProjectWithUniqueSlug(
  owner: string,
  name: string,
  mode: ProjectMode = "popout"
) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const slug = await generateUniqueSlug(name, slugExists);
    try {
      const project = await createProjectDocument(owner, {
        name: name.trim(),
        slug,
        mode,
        settings: { ...DEFAULT_SETTINGS, title: name.trim() }
      });
      return { data: project, error: null };
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      if (!/unique|already exists|Conflict/i.test(message)) {
        return { data: null, error: { message, code: "create_failed" } };
      }
    }
  }

  return {
    data: null,
    error: { message: "Could not reserve a unique project slug", code: "slug_collision" }
  };
}

export function projectSourcePath(owner: string, projectId: string) {
  return `${owner}/${projectId}/source.png`;
}
