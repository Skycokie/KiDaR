import { getLoggedInUser } from "@/lib/appwrite/client";
import { listProjectsForOwner } from "@/lib/appwrite/db";
import {
  fixtureStudioWorlds,
  toStudioWorldCard,
  type StudioWorldsResult
} from "@/lib/studio-worlds";

/**
 * Server-only read model for Studio “Lumile tale”.
 * Import only from Server Components / route handlers — never from client components.
 * Session → own projects as DTOs; no session → fixtures; never mutates.
 */
export async function getStudioWorldsForCurrentUser(): Promise<StudioWorldsResult> {
  const user = await getLoggedInUser();
  if (!user) {
    return { kind: "fixtures", worlds: fixtureStudioWorlds() };
  }

  try {
    const projects = await listProjectsForOwner(user.$id);
    return {
      kind: "live",
      worlds: projects.map((project) => toStudioWorldCard(project))
    };
  } catch {
    return { kind: "error" };
  }
}
