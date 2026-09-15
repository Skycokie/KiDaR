import { generateUniqueSlug, type ProjectMode, type ProjectSettings } from "@kidar/core";
import type { SupabaseClient } from "@supabase/supabase-js";

export const DEFAULT_SETTINGS: ProjectSettings = {
  title: "",
  theme: "#6d5dfc",
  scale: 1,
  offset: { x: 0, y: 0, z: 0 }
};

export async function createProjectWithUniqueSlug(
  supabase: SupabaseClient,
  owner: string,
  name: string,
  mode: ProjectMode = "popout"
) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const slug = await generateUniqueSlug(name, async (candidate) => {
      const { data } = await supabase
        .from("projects")
        .select("id")
        .eq("slug", candidate)
        .maybeSingle();
      return Boolean(data);
    });

    const result = await supabase
      .from("projects")
      .insert({
        owner,
        name: name.trim(),
        slug,
        mode,
        settings: { ...DEFAULT_SETTINGS, title: name.trim() }
      })
      .select("*")
      .single();

    if (result.error?.code !== "23505") return result;
  }

  return {
    data: null,
    error: { message: "Could not reserve a unique project slug", code: "slug_collision" }
  };
}

export function projectSourcePath(owner: string, projectId: string) {
  return `${owner}/${projectId}/source.png`;
}
