/**
 * Emergency: mark a figurine job terminal error to stop retry credit burn.
 * Does not call Tripo. Does not publish.
 */
import { Client, Databases } from "node-appwrite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv(path: string) {
  try {
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!m || process.env[m[1]] !== undefined) continue;
      let v = m[2];
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      process.env[m[1]] = v;
    }
  } catch {
    // optional
  }
}

const root = /[\\/]apps[\\/]worker$/i.test(process.cwd())
  ? resolve(process.cwd(), "../..")
  : process.cwd();
loadEnv(resolve(root, ".env.local"));
loadEnv(resolve(root, "apps/web/.env.local"));

async function main() {
  const jobId = process.argv[2];
  const projectId = process.argv[3];
  if (!jobId || !projectId) {
    throw new Error("Usage: stop-figurine-job.ts <jobId> <projectId>");
  }
  const c = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
    .setKey(process.env.APPWRITE_API_KEY!);
  const db = new Databases(c);
  const databaseId = process.env.APPWRITE_DATABASE_ID || "kidar";
  const jobsCollection = process.env.APPWRITE_JOBS_COLLECTION || "jobs";
  const projectsCollection = process.env.APPWRITE_PROJECTS_COLLECTION || "projects";

  const job = await db.getDocument(databaseId, jobsCollection, jobId);
  const bag =
    typeof (job as { payload?: unknown }).payload === "string"
      ? (JSON.parse((job as { payload: string }).payload) as Record<string, unknown>)
      : ((job as { payload?: Record<string, unknown> }).payload ?? {});

  await db.updateDocument(databaseId, jobsCollection, jobId, {
    status: "error",
    attempt: Number((job as { max_attempts?: number }).max_attempts ?? 3),
    next_run_at: null,
    locked_at: null,
    lock_token: null,
    payload: JSON.stringify({
      ...bag,
      last_error:
        "[TRIPO_RETOPO_TIMEOUT] Stopped retries to avoid duplicate Image-to-3D after retopo timeout",
      result: {
        ...((bag.result as Record<string, unknown> | null) ?? {}),
        provider: "tripo",
        phase: "failed",
        progress: 0,
        failureCode: "TRIPO_RETOPO_TIMEOUT",
        failureMessage:
          "Retopo timed out; retries stopped (preserve credits). Redeploy with longer retopo timeout + failure ID preserve."
      }
    })
  });

  const project = await db.getDocument(databaseId, projectsCollection, projectId);
  const settings =
    typeof (project as { settings?: unknown }).settings === "string"
      ? (JSON.parse((project as { settings: string }).settings) as Record<string, unknown>)
      : ((project as { settings?: Record<string, unknown> }).settings ?? {});
  const subjects = Array.isArray(settings.figurineSubjects)
    ? (settings.figurineSubjects as Record<string, unknown>[])
    : [];
  const nextSubjects = subjects.map((s) =>
    s.id === "primary"
      ? {
          ...s,
          status: "failed",
          progress: 0,
          failureCode: "TRIPO_RETOPO_TIMEOUT",
          failureMessage: "Retopo timed out; retries stopped"
        }
      : s
  );
  await db.updateDocument(databaseId, projectsCollection, projectId, {
    status: "error",
    settings: JSON.stringify({ ...settings, figurineSubjects: nextSubjects })
  });

  console.log(
    JSON.stringify({
      stopped: true,
      jobId,
      projectId,
      publish: false,
      reason: "prevent_attempt3_image_to_3d"
    })
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
