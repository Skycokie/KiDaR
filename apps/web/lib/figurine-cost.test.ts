import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { FIGURINE_COST_UNVERIFIED_BODY, verifyFigurineCost } from "./figurine-cost";

const WEB_ROOT = join(__dirname, "..");

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, out);
    else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

const rel = (file: string) => relative(WEB_ROOT, file).split(sep).join("/");

describe("figurine cost control", () => {
  it("stays unverified and never derives from input", () => {
    expect(verifyFigurineCost()).toEqual({ status: "unverified" });
    expect(verifyFigurineCost.length).toBe(0);
    expect(FIGURINE_COST_UNVERIFIED_BODY.error).toBe("cost_unverified");
  });

  it("every web code path that enqueues jobs is accounted for and gated when it can build figurines", () => {
    const callers = sourceFiles(WEB_ROOT)
      .filter((file) => /\benqueueJob\(/.test(readFileSync(file, "utf8")))
      .map(rel)
      .sort();

    // Adding a new job producer must be a conscious decision: update this list AND gate it.
    expect(callers).toEqual([
      "app/api/projects/[projectId]/figurine/route.ts",
      "app/api/projects/[projectId]/route.ts",
      "app/api/publish/route.ts",
      "lib/appwrite/jobs.ts"
    ]);

    const read = (path: string) => readFileSync(join(WEB_ROOT, path), "utf8");
    for (const gated of ["app/api/projects/[projectId]/figurine/route.ts", "app/api/publish/route.ts"]) {
      expect(read(gated)).toContain("verifyFigurineCost()");
    }

    // DELETE project only ever enqueues "unpublish".
    const projectRoute = read("app/api/projects/[projectId]/route.ts");
    expect(projectRoute).not.toMatch(/"(figurine_build|popout_build|mind_compile|page_render)"/);
    expect(projectRoute.match(/type:\s*"[a-z_]+"/g)).toEqual(['type: "unpublish"']);
  });

  it("has no other route or helper that writes job documents", () => {
    const creators = sourceFiles(WEB_ROOT)
      .filter((file) => /\bcreateJobDocument\(/.test(readFileSync(file, "utf8")))
      .map(rel);
    // Only the (unused) definition itself.
    expect(creators).toEqual(["lib/appwrite/db.ts"]);
  });
});
