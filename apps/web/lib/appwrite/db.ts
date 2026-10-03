import type { Models } from "node-appwrite";
import { ID, Query } from "node-appwrite";
import type { ProjectMode, ProjectSettings } from "@kidar/core";
import {
  APPWRITE_DATABASE_ID,
  APPWRITE_JOBS_COLLECTION,
  APPWRITE_PROFILES_COLLECTION,
  APPWRITE_PROJECTS_COLLECTION
} from "./config";
import { createAdminClient, createSessionClient } from "./client";
import { ownerReadOnlyPermissions } from "./permissions";
import { isCreditsBypassEnabled } from "@/lib/credits";

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
  terms_accepted_at: string | null;
  credits: number;
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
  const creditsRaw = data.credits;
  const credits =
    typeof creditsRaw === "number" && Number.isFinite(creditsRaw)
      ? Math.max(0, Math.floor(creditsRaw))
      : 0;
  return {
    id: data.$id,
    plan: data.plan === "paid" ? "paid" : "free",
    stripe_customer_id: (data.stripe_customer_id as string | null) ?? null,
    terms_accepted_at:
      typeof data.terms_accepted_at === "string" && data.terms_accepted_at.trim()
        ? data.terms_accepted_at
        : null,
    credits,
    created_at: data.$createdAt
  };
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
      { plan: "free", stripe_customer_id: null, terms_accepted_at: null, credits: 0 },
      ownerReadOnlyPermissions(userId)
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

/** Admin-only profile patch. Owner documents are read-only for the session client. */
export async function updateProfileDocument(
  userId: string,
  patch: Record<string, unknown>
): Promise<ProfileRecord> {
  const { databases } = createAdminClient();
  const doc = await databases.updateDocument(
    APPWRITE_DATABASE_ID,
    APPWRITE_PROFILES_COLLECTION,
    userId,
    patch
  );
  return mapProfile(doc);
}

/** Persist publish terms acceptance. Idempotent when already set. */
export async function acceptPublishTerms(userId: string): Promise<ProfileRecord> {
  const profile = await ensureProfile(userId);
  if (profile.terms_accepted_at) return profile;
  return updateProfileDocument(userId, {
    terms_accepted_at: new Date().toISOString()
  });
}

export type CreditDebitResult =
  | { ok: true; credits: number; bypassed: boolean }
  | { ok: false; code: "insufficient_credits"; credits: number };

/**
 * Debit Tripo credits. Caller must only invoke after enqueue creates a new job.
 * Uses admin client; never expose update to the session.
 */
export async function debitCredits(
  userId: string,
  amount: number
): Promise<CreditDebitResult> {
  if (!Number.isInteger(amount) || amount < 1) {
    throw new Error("debit amount must be a positive integer");
  }
  if (isCreditsBypassEnabled()) {
    const profile = await ensureProfile(userId);
    return { ok: true, credits: profile.credits, bypassed: true };
  }
  const profile = await ensureProfile(userId);
  if (profile.credits < amount) {
    return { ok: false, code: "insufficient_credits", credits: profile.credits };
  }
  const updated = await updateProfileDocument(userId, {
    credits: profile.credits - amount
  });
  return { ok: true, credits: updated.credits, bypassed: false };
}

/** Refund credits after a pre-provider terminal failure. Admin-only. */
export async function creditCredits(
  userId: string,
  amount: number
): Promise<ProfileRecord> {
  if (!Number.isInteger(amount) || amount < 1) {
    throw new Error("credit amount must be a positive integer");
  }
  const profile = await ensureProfile(userId);
  return updateProfileDocument(userId, {
    credits: profile.credits + amount
  });
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
  const { databases } = createAdminClient();
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
    ownerReadOnlyPermissions(owner)
  );
  return mapProject(doc);
}

export async function updateProjectDocument(
  projectId: string,
  patch: Record<string, unknown>
): Promise<ProjectRecord> {
  const { databases } = createAdminClient();
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
  const { databases } = createAdminClient();
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
  const { databases } = createAdminClient();
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
    ownerReadOnlyPermissions(data.owner)
  );
}
