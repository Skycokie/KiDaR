import type { Models } from "node-appwrite";
import { ID, Permission, Query, Role } from "node-appwrite";
import type { ProjectMode, ProjectSettings } from "@kidar/core";
import {
  APPWRITE_DATABASE_ID,
  APPWRITE_JOBS_COLLECTION,
  APPWRITE_PROFILES_COLLECTION,
  APPWRITE_PROJECTS_COLLECTION
} from "./config";
import { createAdminClient, createSessionClient } from "./client";

export type Plan = "free" | "paid";

export type ProjectRecord = {
  id: string;
  owner: string;
  name: string;
  slug: string;
  mode: ProjectMode;
  source_image_path: string | null;
  mind_path: string | null;
  glb_path: string | null;
  status: string;
  settings: ProjectSettings;
  created_at: string;
  updated_at: string;
};

export type ProfileRecord = {
  id: string;
  plan: Plan;
  stripe_customer_id: string | null;
  created_at: string;
};

function parseSettings(value: unknown): ProjectSettings {
  if (!value) {
    return { title: "", theme: "#6d5dfc", scale: 1, offset: { x: 0, y: 0, z: 0 } };
  }
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as ProjectSettings;
    } catch {
      return { title: "", theme: "#6d5dfc", scale: 1, offset: { x: 0, y: 0, z: 0 } };
    }
  }
  return value as ProjectSettings;
}

export function mapProject(doc: Models.Document): ProjectRecord {
  const data = doc as Models.Document & Record<string, unknown>;
  return {
    id: data.$id,
    owner: String(data.owner),
    name: String(data.name),
    slug: String(data.slug),
    mode: data.mode as ProjectMode,
    source_image_path: (data.source_image_path as string | null) ?? null,
    mind_path: (data.mind_path as string | null) ?? null,
    glb_path: (data.glb_path as string | null) ?? null,
    status: String(data.status ?? "draft"),
    settings: parseSettings(data.settings),
    created_at: data.$createdAt,
    updated_at: data.$updatedAt
  };
}

export function mapProfile(doc: Models.Document): ProfileRecord {
  const data = doc as Models.Document & Record<string, unknown>;
  return {
    id: data.$id,
    plan: data.plan === "paid" ? "paid" : "free",
    stripe_customer_id: (data.stripe_customer_id as string | null) ?? null,
    created_at: data.$createdAt
  };
}

function ownerPermissions(userId: string) {
  return [
    Permission.read(Role.user(userId)),
    Permission.update(Role.user(userId)),
    Permission.delete(Role.user(userId))
  ];
}

export async function ensureProfile(userId: string): Promise<ProfileRecord> {
  const { databases } = createAdminClient();
  try {
    const existing = await databases.getDocument(
      APPWRITE_DATABASE_ID,
      APPWRITE_PROFILES_COLLECTION,
      userId
    );
    return mapProfile(existing);
  } catch {
    const created = await databases.createDocument(
      APPWRITE_DATABASE_ID,
      APPWRITE_PROFILES_COLLECTION,
      userId,
      { plan: "free", stripe_customer_id: null },
      ownerPermissions(userId)
    );
    return mapProfile(created);
  }
}

export async function getProfile(userId: string): Promise<ProfileRecord> {
  const { databases } = createSessionClient();
  try {
    const doc = await databases.getDocument(
      APPWRITE_DATABASE_ID,
      APPWRITE_PROFILES_COLLECTION,
      userId
    );
    return mapProfile(doc);
  } catch {
    return ensureProfile(userId);
  }
}

export async function listProjectsForOwner(owner: string): Promise<ProjectRecord[]> {
  const { databases } = createSessionClient();
  const result = await databases.listDocuments(
    APPWRITE_DATABASE_ID,
    APPWRITE_PROJECTS_COLLECTION,
    [Query.equal("owner", owner), Query.orderDesc("$createdAt"), Query.limit(100)]
  );
  return result.documents.map(mapProject);
}

export async function countProjectsForOwner(owner: string): Promise<number> {
  const { databases } = createSessionClient();
  const result = await databases.listDocuments(
    APPWRITE_DATABASE_ID,
    APPWRITE_PROJECTS_COLLECTION,
    [Query.equal("owner", owner), Query.limit(1)]
  );
  return result.total;
}

export async function getProjectForOwner(
  projectId: string,
  owner: string
): Promise<ProjectRecord | null> {
  const { databases } = createSessionClient();
  try {
    const doc = await databases.getDocument(
      APPWRITE_DATABASE_ID,
      APPWRITE_PROJECTS_COLLECTION,
      projectId
    );
    const project = mapProject(doc);
    return project.owner === owner ? project : null;
  } catch {
    return null;
  }
}

export async function slugExists(slug: string): Promise<boolean> {
  const { databases } = createAdminClient();
  const result = await databases.listDocuments(
    APPWRITE_DATABASE_ID,
    APPWRITE_PROJECTS_COLLECTION,
    [Query.equal("slug", slug), Query.limit(1)]
  );
  return result.total > 0;
}

export async function createProjectDocument(
  owner: string,
  data: {
    name: string;
    slug: string;
    mode: ProjectMode;
    settings: ProjectSettings;
  }
): Promise<ProjectRecord> {
  const { databases } = createSessionClient();
  const doc = await databases.createDocument(
    APPWRITE_DATABASE_ID,
    APPWRITE_PROJECTS_COLLECTION,
    ID.unique(),
    {
      owner,
      name: data.name,
      slug: data.slug,
      mode: data.mode,
      status: "draft",
      settings: JSON.stringify(data.settings)
    },
    ownerPermissions(owner)
  );
  return mapProject(doc);
}

export async function updateProjectDocument(
  projectId: string,
  patch: Record<string, unknown>
): Promise<ProjectRecord> {
  const { databases } = createSessionClient();
  const payload = { ...patch };
  if (payload.settings && typeof payload.settings !== "string") {
    payload.settings = JSON.stringify(payload.settings);
  }
  const doc = await databases.updateDocument(
    APPWRITE_DATABASE_ID,
    APPWRITE_PROJECTS_COLLECTION,
    projectId,
    payload
  );
  return mapProject(doc);
}

export async function deleteProjectDocument(projectId: string): Promise<void> {
  const { databases } = createSessionClient();
  await databases.deleteDocument(
    APPWRITE_DATABASE_ID,
    APPWRITE_PROJECTS_COLLECTION,
    projectId
  );
}

export async function createJobDocument(data: {
  project_id: string;
  step: string;
  status: string;
  payload: Record<string, unknown>;
  owner: string;
}) {
  const { databases } = createSessionClient();
  return databases.createDocument(
    APPWRITE_DATABASE_ID,
    APPWRITE_JOBS_COLLECTION,
    ID.unique(),
    {
      project_id: data.project_id,
      step: data.step,
      status: data.status,
      payload: JSON.stringify(data.payload)
    },
    ownerPermissions(data.owner)
  );
}
