/**
 * Read-only, pure: decide whether publish may reuse an already generated figurine model
 * instead of creating a new `figurine_build` (paid Tripo) job.
 *
 * Evidence comes only from server-written job documents plus a recomputed hash. Nothing
 * from the request and nothing owner-writable (`settings.figurineModelUrl`,
 * `figurineSubjects`, ...) is trusted as authority.
 *
 * A job is reusable only when ALL of these hold:
 *  - it is in the worker's per-project window (the caller passes exactly that window);
 *  - it belongs to this project, type `figurine_build`, status `done`;
 *  - `artifactHash` is present and `result.kind` is the figurine GLB;
 *  - `result.artifactKey` equals the key recomputed from projectId + inputHash;
 *  - `result.publicUrl` equals the public URL recomputed from that key;
 *  - `result.pipeline` equals the pipeline label this code base accepts;
 *  - `job.inputHash` equals the hash recomputed from the CURRENT project (current source,
 *    current hashed settings, current pipeline version). The hash is a commitment, so a
 *    match proves the job was generated from the current source and pipeline. The only
 *    setting allowed to differ is `figurineModelUrl`, which the worker itself rewrites on
 *    completion; it may be absent or a URL produced by one of this project's own jobs.
 *
 * Known limits (by design, fail closed): any edit to a hashed setting after generation,
 * a changed source image, or a text-to-3D job cannot be proven and is refused. R2 object
 * existence/checksum is NOT re-verified from the web (same trust page_render has today).
 */

import {
  FIGURINE_ARTIFACT_KIND,
  figurineArtifactKey,
  figurinePipelineLabel,
  type PipelineJob,
  type ProjectMode,
  type ProjectSettings
} from "@kidar/core";
import { publishContentHash } from "@/lib/publish-identity";

export type ReusableFigurineProject = {
  id: string;
  mode: ProjectMode;
  slug: string;
  source_image_path: string | null;
  settings: ProjectSettings;
};

const HEX_HASH = /^[a-f0-9]{64}$/;

function isStructurallyValid(
  job: PipelineJob,
  project: ReusableFigurineProject,
  publicUrlForKey: (key: string) => string
): boolean {
  if (job.type !== "figurine_build" || job.status !== "done") return false;
  if (job.projectId !== project.id) return false;
  if (typeof job.artifactHash !== "string" || !job.artifactHash) return false;
  if (!HEX_HASH.test(job.inputHash)) return false;
  if (!Number.isFinite(Date.parse(job.createdAt))) return false;
  const result = job.result;
  if (!result || result.kind !== FIGURINE_ARTIFACT_KIND) return false;
  if (result.pipeline !== figurinePipelineLabel()) return false;
  try {
    const key = figurineArtifactKey(project.id, job.inputHash);
    if (result.artifactKey !== key) return false;
    return typeof result.publicUrl === "string" && result.publicUrl === publicUrlForKey(key);
  } catch {
    return false;
  }
}

/** Newest first by `$createdAt`; ties broken by id so the choice is always stable. */
function compareNewestFirst(a: PipelineJob, b: PipelineJob): number {
  const delta = Date.parse(b.createdAt) - Date.parse(a.createdAt);
  if (delta !== 0) return delta;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function selectReusableFigurineBuild(input: {
  project: ReusableFigurineProject;
  /** Exactly the worker's per-project job window (newest first, all types). */
  windowJobs: PipelineJob[];
  publicUrlForKey: (key: string) => string;
}): PipelineJob | null {
  const { project, windowJobs, publicUrlForKey } = input;
  if (project.mode !== "figurine_3d") return null;

  const valid = windowJobs.filter((job) => isStructurallyValid(job, project, publicUrlForKey));
  if (!valid.length) return null;

  // Hash the project would have had at generation time: current source + current hashed
  // settings, with figurineModelUrl absent or one of this project's own job URLs.
  const ownUrls = new Set(valid.map((job) => String(job.result?.publicUrl)));
  const candidateUrls: Array<string | undefined> = [undefined, ...ownUrls];
  const provable = new Set<string>();
  for (const url of candidateUrls) {
    provable.add(
      publishContentHash({
        ...project,
        settings: { ...project.settings, figurineModelUrl: url }
      })
    );
  }

  const proven = valid.filter((job) => provable.has(job.inputHash)).sort(compareNewestFirst);
  return proven[0] ?? null;
}
