import { Client, Databases, Users } from "node-appwrite";
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
  const c = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
    .setKey(process.env.APPWRITE_API_KEY!);
  const db = new Databases(c);
  const users = new Users(c);
  const doc = await db.getDocument(
    process.env.APPWRITE_DATABASE_ID || "kidar",
    process.env.APPWRITE_PROJECTS_COLLECTION || "projects",
    "6aafaf8500011d0ac857"
  );
  const ownerId = String((doc as { owner?: string }).owner ?? "");
  const user = await users.get(ownerId);
  const settings =
    typeof (doc as { settings?: unknown }).settings === "string"
      ? JSON.parse((doc as { settings: string }).settings)
      : (doc as { settings?: unknown }).settings;
  console.log(
    JSON.stringify(
      {
        projectId: doc.$id,
        ownerIdPrefix: ownerId.slice(0, 8),
        email: user.email,
        mode: (doc as { mode?: string }).mode,
        status: (doc as { status?: string }).status,
        hasFigurineModelUrl: Boolean(
          (settings as { figurineModelUrl?: string } | null)?.figurineModelUrl
        )
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
