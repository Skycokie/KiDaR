import { describe, expect, it } from "vitest";
import { figurineArtifactKey, figurinePipelineLabel, type PipelineJob } from "@kidar/core";
import { publishContentHash } from "@/lib/publish-identity";
import { selectReusableFigurineBuild, type ReusableFigurineProject } from "./figurine-reuse";

const CDN = "https://cdn.example.com";
const publicUrlForKey = (key: string) => `${CDN}/${key}`;

const project: ReusableFigurineProject = {
  id: "proj1",
  mode: "figurine_3d",
  slug: "dragon",
  source_image_path: "file-source-1",
  settings: { title: "Dragon", theme: "#6d5dfc", scale: 1, offset: { x: 0, y: 0, z: 0 } }
};

/** Hash a generation job had, given the project state and the model URL present at that time. */
function hashFor(p: ReusableFigurineProject, figurineModelUrl?: string) {
  return publishContentHash({ ...p, settings: { ...p.settings, figurineModelUrl } });
}

function job(overrides: Partial<PipelineJob> & { inputHash?: string } = {}, id = "job-a"): PipelineJob {
  const inputHash = overrides.inputHash ?? hashFor(project);
  const key = figurineArtifactKey(project.id, inputHash);
  return {
    id,
    projectId: "proj1",
    type: "figurine_build",
    status: "done",
    attempt: 1,
    maxAttempts: 3,
    nextRunAt: null,
    lockedAt: null,
    lockToken: null,
    lastError: null,
    inputHash,
    artifactHash: "artifact-sha",
    result: {
      kind: "figurine.glb",
      publicUrl: publicUrlForKey(key),
      artifactKey: key,
      pipeline: figurinePipelineLabel(),
      phase: "ready"
    },
    createdAt: "2026-02-01T10:00:00.000Z",
    updatedAt: "2026-02-01T10:05:00.000Z",
    ...overrides
  } as PipelineJob;
}

const select = (windowJobs: PipelineJob[], p: ReusableFigurineProject = project) =>
  selectReusableFigurineBuild({ project: p, windowJobs, publicUrlForKey });

describe("selectReusableFigurineBuild", () => {
  it("reuses a finished job proven by recomputed hash, key, url and pipeline", () => {
    const valid = job();
    expect(select([valid])?.id).toBe("job-a");
  });

  it("ignores settings.figurineModelUrl entirely (absent, own URL or foreign URL)", () => {
    const valid = job();
    const own = String(valid.result?.publicUrl);
    for (const figurineModelUrl of [undefined, own, "https://evil.example/other.glb"]) {
      const p = { ...project, settings: { ...project.settings, figurineModelUrl } };
      expect(select([valid], p)?.id).toBe("job-a");
    }
  });

  it("refuses when there is nothing to reuse", () => {
    expect(select([])).toBeNull();
    expect(select([job({ type: "mind_compile" } as never)])).toBeNull();
  });

  it.each([
    ["queued", { status: "queued" }],
    ["running", { status: "running" }],
    ["error", { status: "error" }],
    ["another project", { projectId: "someone-else" }],
    ["missing artifactHash", { artifactHash: null }],
    ["empty artifactHash", { artifactHash: "" }],
    ["non-hex inputHash", { inputHash: "not-a-hash" }],
    ["unparseable createdAt", { createdAt: "yesterday" }],
    ["no result", { result: null }]
  ])("refuses a job that is %s", (_label, overrides) => {
    expect(select([job(overrides as Partial<PipelineJob>)])).toBeNull();
  });

  it.each([
    ["wrong kind", { kind: "popout.glb" }],
    ["missing pipeline", { pipeline: undefined }],
    ["other pipeline version", { pipeline: "figurine@figurine-tripo-v1" }],
    ["artifactKey of another hash", { artifactKey: figurineArtifactKey("proj1", "a".repeat(64)) }],
    ["artifactKey of another project", { artifactKey: figurineArtifactKey("proj2", hashFor(project)) }],
    ["foreign public URL", { publicUrl: "https://evil.example/models/proj1/x/figurine.glb" }],
    ["public URL of another key", { publicUrl: publicUrlForKey(figurineArtifactKey("proj1", "b".repeat(64))) }],
    ["missing public URL", { publicUrl: undefined }]
  ])("refuses a result with %s", (_label, resultPatch) => {
    const base = job();
    const tampered = { ...base, result: { ...base.result, ...resultPatch } } as PipelineJob;
    expect(select([tampered])).toBeNull();
  });

  it("refuses when the project was edited after generation (hashed setting changed)", () => {
    const edited = { ...project, settings: { ...project.settings, title: "Alt titlu" } };
    expect(select([job()], edited)).toBeNull();
  });

  it("refuses when the project source was replaced (no proof the job belongs to the current source)", () => {
    expect(select([job()], { ...project, source_image_path: "file-source-2" })).toBeNull();
  });

  it("refuses a job whose hash cannot be reproduced (e.g. text-to-3D or unknown settings)", () => {
    expect(select([job({ inputHash: "c".repeat(64) })])).toBeNull();
  });

  it("refuses non figurine modes", () => {
    expect(select([job()], { ...project, mode: "popout" })).toBeNull();
  });

  describe("several valid jobs (regeneration chain)", () => {
    const first = job({ createdAt: "2026-02-01T10:00:00.000Z" }, "job-1");
    // The second generation was hashed while the project already held the first model URL.
    const secondHash = hashFor(project, String(first.result?.publicUrl));
    const second = job({ inputHash: secondHash, createdAt: "2026-02-02T10:00:00.000Z" }, "job-2");
    const p = {
      ...project,
      settings: { ...project.settings, figurineModelUrl: String(second.result?.publicUrl) }
    };

    it("proves both, picks the newest by createdAt regardless of array order", () => {
      expect(select([first, second], p)?.id).toBe("job-2");
      expect(select([second, first], p)?.id).toBe("job-2");
    });

    it("picks the other one when the timestamps say so", () => {
      const reversed = job({ inputHash: secondHash, createdAt: "2026-01-01T00:00:00.000Z" }, "job-2");
      expect(select([first, reversed], p)?.id).toBe("job-1");
    });

    it("breaks identical timestamps by id so the choice is stable", () => {
      const a = job({ createdAt: "2026-02-01T10:00:00.000Z" }, "job-a");
      const b = job({ createdAt: "2026-02-01T10:00:00.000Z" }, "job-b");
      expect(select([a, b])?.id).toBe("job-a");
      expect(select([b, a])?.id).toBe("job-a");
    });

    it("does not accept a hash built on a model URL that none of this project's jobs produced", () => {
      const foreignHash = hashFor(project, "https://evil.example/models/x.glb");
      expect(select([job({ inputHash: foreignHash })])).toBeNull();
    });
  });
});
