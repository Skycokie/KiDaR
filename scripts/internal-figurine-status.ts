import { Client, Databases, Query } from "node-appwrite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv(path: string) {
  try {
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!m || process.env[m[1]] !== undefined) continue;
      let v = m[2];
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      process.env[m[1]] = v;
    }
  } catch {
    // optional
  }
}

const root = /[\\/]apps[\\/]worker$/i.test(process.cwd()) ? resolve(process.cwd(), "../..") : process.cwd();
loadEnv(resolve(root, ".env.local"));
loadEnv(resolve(root, "apps/web/.env.local"));

async function main() {
  const jobId = process.argv[2] || "6ab14825000d97d142dc";
  const projectId = process.argv[3] || "6aafaf8500011d0ac857";
  const c = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
    .setKey(process.env.APPWRITE_API_KEY!);
  const db = new Databases(c);
  const databaseId = process.env.APPWRITE_DATABASE_ID || "kidar";
  const jobsCollection = process.env.APPWRITE_JOBS_COLLECTION || "jobs";
  const projectsCollection = process.env.APPWRITE_PROJECTS_COLLECTION || "projects";

  const job = await db.getDocument(databaseId, jobsCollection, jobId);
  const project = await db.getDocument(databaseId, projectsCollection, projectId);
  const bag =
    typeof (job as { payload?: unknown }).payload === "string"
      ? JSON.parse((job as { payload: string }).payload)
      : (job as { payload?: unknown }).payload;
  const settings =
    typeof (project as { settings?: unknown }).settings === "string"
      ? JSON.parse((project as { settings: string }).settings)
      : (project as { settings?: unknown }).settings;

  console.log(
    JSON.stringify(
      {
        now: new Date().toISOString(),
        job: {
          id: job.$id,
          project_id: (job as { project_id?: string }).project_id,
          step: (job as { step?: string }).step,
          status: (job as { status?: string }).status,
          attempt: (job as { attempt?: number }).attempt,
          next_run_at: (job as { next_run_at?: string }).next_run_at,
          locked_at: (job as { locked_at?: string | null }).locked_at,
          lock_token: (job as { lock_token?: string | null }).lock_token,
          payload: bag
        },
        project: {
          id: project.$id,
          mode: (project as { mode?: string }).mode,
          status: (project as { status?: string }).status,
          figurineModelUrl: (settings as { figurineModelUrl?: string } | null)?.figurineModelUrl ?? null,
          subjects: (settings as { figurineSubjects?: unknown } | null)?.figurineSubjects ?? null
        }
      },
      null,
      2
    )
  );

  const queued = await db.listDocuments(databaseId, jobsCollection, [
    Query.equal("status", "queued"),
    Query.equal("step", "figurine_build"),
    Query.limit(10)
  ]);
  console.log(
    JSON.stringify(
      {
        queuedFigurineCount: queued.total,
        queuedIds: queued.documents.map((d) => ({
          id: d.$id,
          next_run_at: (d as { next_run_at?: string }).next_run_at,
          project_id: (d as { project_id?: string }).project_id
        }))
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
