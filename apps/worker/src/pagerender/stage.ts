import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  IMMUTABLE_CACHE_CONTROL,
  PAGE_ARTIFACT_FILES,
  PAGE_POINTER_CACHE_CONTROL,
  PUBLIC_ARTIFACT_CONTENT_TYPES,
  PageRenderError,
  PublicStorageConfigError,
  assertModelUrlForMode,
  assertPublicHtmlBundle,
  assertSupportedSourceImage,
  consumerArUrl,
  experiencePointerKey,
  generateA4PrintPdf,
  generateArQrPng,
  mapSettingsToArPageConfig,
  pageArtifactKey,
  pageRenderPipelineLabel,
  publicUrlFromJob,
  renderArPage,
  resolvePageRenderDependsOn,
  type PipelineJob,
  type ProjectSettings,
  type PublicArtifactStorage
} from "@kidar/core";
import { computeArtifactHash, sha256Hex } from "@kidar/core/hash";
import {
  completeJob,
  downloadSourceFile,
  failJob,
  getProjectRecord,
  listJobsForProject
} from "../appwrite/jobs";

export type PageRenderStageDeps = {
  storage: PublicArtifactStorage;
  appOrigin: string;
  allowLocalOrigins?: boolean;
  loadProject?: typeof getProjectRecord;
  loadSource?: (fileId: string) => Promise<Uint8Array>;
  loadAsset?: (fileId: string) => Promise<Uint8Array | null>;
  listJobs?: (projectId: string) => Promise<
    Array<Pick<PipelineJob, "type" | "status" | "inputHash" | "result">>
  >;
  complete?: typeof completeJob;
  fail?: typeof failJob;
  markProject?: (
    projectId: string,
    status: "ready" | "error",
    settings?: Partial<ProjectSettings>
  ) => Promise<void>;
};

export type PageRenderStageResult = {
  kind: "written" | "idempotent";
  artifactKey: string;
  artifactHash: string;
  publicUrl: string;
  qrUrl: string;
  pdfUrl: string;
  experienceUrl: string;
};

async function writeVerified(
  storage: PublicArtifactStorage,
  input: {
    key: string;
    body: Uint8Array;
    contentType: string;
    checksum: string;
    cacheControl?: string;
  }
): Promise<{ key: string; publicUrl: string; idempotent: boolean }> {
  const existing = await storage.getMetadata(input.key);
  if (existing?.checksum && existing.checksum === input.checksum) {
    return { key: input.key, publicUrl: storage.getPublicUrl(input.key), idempotent: true };
  }
  const written = await storage.write({
    key: input.key,
    body: input.body,
    contentType: input.contentType,
    checksum: input.checksum,
    cacheControl: input.cacheControl ?? IMMUTABLE_CACHE_CONTROL
  });
  const verified = await storage.getMetadata(input.key);
  if (!verified || verified.checksum !== input.checksum) {
    throw new PageRenderError("Public artifact verification failed after write", {
      retryable: true,
      code: "VERIFY_FAILED"
    });
  }
  return { ...written, idempotent: false };
}

/**
 * Render standalone AR HTML + QR + PDF and publish to R2.
 * Marks the job done only after every required object verifies.
 */
export async function runPageRenderStage(
  job: PipelineJob,
  deps: PageRenderStageDeps
): Promise<PageRenderStageResult> {
  if (!job.lockToken) {
    throw new PageRenderError("Claimed job is missing lockToken", {
      retryable: false,
      code: "MISSING_LOCK"
    });
  }

  const loadProject = deps.loadProject ?? getProjectRecord;
  const loadSource = deps.loadSource ?? downloadSourceFile;
  const listJobs = deps.listJobs ?? listJobsForProject;
  const complete = deps.complete ?? completeJob;

  const project = await loadProject(job.projectId);
  const sourceBytes = project.sourceImagePath ? await loadSource(project.sourceImagePath) : null;
  if (!sourceBytes?.byteLength) {
    throw new PageRenderError("Source drawing bytes are required for print PDF", {
      retryable: false,
      code: "MISSING_SOURCE"
    });
  }
  const sourceMime = assertSupportedSourceImage(sourceBytes);

  const siblings = await listJobs(job.projectId);
  const dependsOn = resolvePageRenderDependsOn(project.mode, job);
  const targetUrl = publicUrlFromJob(siblings, "mind_compile", dependsOn.mind_compile);
  const modelUrl = assertModelUrlForMode(
    project.mode,
    project.mode === "popout"
      ? publicUrlFromJob(siblings, "popout_build", dependsOn.popout_build ?? job.inputHash)
      : project.settings.galleryModelUrl || project.settings.uploadModelUrl,
    { allowLocalOrigins: deps.allowLocalOrigins }
  );

  let audioUrl: string | null = null;
  if (project.settings.soundPath && deps.loadAsset) {
    const sound = await deps.loadAsset(project.settings.soundPath);
    if (sound?.byteLength) {
      const soundKey = pageArtifactKey(job.projectId, job.inputHash, PAGE_ARTIFACT_FILES.sound);
      const soundHash = computeArtifactHash({
        inputHash: job.inputHash,
        artifactKind: "sound.mp3",
        contentChecksum: sha256Hex(sound)
      });
      const written = await writeVerified(deps.storage, {
        key: soundKey,
        body: sound,
        contentType: PUBLIC_ARTIFACT_CONTENT_TYPES.mp3,
        checksum: soundHash
      });
      audioUrl = written.publicUrl;
    }
  }

  const mapped = mapSettingsToArPageConfig({
    settings: project.settings,
    modelUrl,
    targetUrl,
    audioUrl,
    allowLocalOrigins: deps.allowLocalOrigins,
    showWatermark: true
  });
  const html = renderArPage({
    title: mapped.title,
    theme: mapped.theme,
    modelUrl: mapped.modelUrl,
    targetUrl: mapped.targetUrl,
    logoUrl: mapped.logoUrl ?? undefined,
    ctaText: mapped.ctaText ?? undefined,
    ctaUrl: mapped.ctaUrl ?? undefined,
    audioUrl: mapped.audioUrl ?? undefined,
    transform: { position: mapped.position, rotation: mapped.rotation, scale: mapped.scale },
    showWatermark: mapped.showWatermark,
    allowLocalOrigins: deps.allowLocalOrigins
  });
  assertPublicHtmlBundle(html, { modelUrl: mapped.modelUrl, targetUrl: mapped.targetUrl });

  const experienceUrl = consumerArUrl(deps.appOrigin, project.slug, {
    allowLocalOrigins: deps.allowLocalOrigins
  });
  const qrPng = await generateArQrPng(experienceUrl, {
    allowLocalOrigins: deps.allowLocalOrigins
  });
  const pdfBytes = await generateA4PrintPdf({
    sourceImageBytes: sourceBytes,
    sourceMimeType: sourceMime,
    qrPngBytes: qrPng,
    instructionLine: "Scaneaza codul QR cu telefonul pentru a vedea desenul in realitate augmentata.",
    showWatermark: true
  });

  const htmlBody = new Uint8Array(Buffer.from(html, "utf8"));
  const htmlKey = pageArtifactKey(job.projectId, job.inputHash, PAGE_ARTIFACT_FILES.html);
  const qrKey = pageArtifactKey(job.projectId, job.inputHash, PAGE_ARTIFACT_FILES.qr);
  const pdfKey = pageArtifactKey(job.projectId, job.inputHash, PAGE_ARTIFACT_FILES.pdf);
  const htmlHash = computeArtifactHash({
    inputHash: job.inputHash,
    artifactKind: "index.html",
    contentChecksum: sha256Hex(htmlBody)
  });
  const qrHash = computeArtifactHash({
    inputHash: job.inputHash,
    artifactKind: "qr.png",
    contentChecksum: sha256Hex(qrPng)
  });
  const pdfHash = computeArtifactHash({
    inputHash: job.inputHash,
    artifactKind: "print.pdf",
    contentChecksum: sha256Hex(pdfBytes)
  });
  const bundleHash = computeArtifactHash({
    inputHash: job.inputHash,
    artifactKind: "page_bundle",
    contentChecksum: sha256Hex(`${htmlHash}:${qrHash}:${pdfHash}`)
  });

  const tempRoot = await mkdtemp(path.join(tmpdir(), "kidar-page-"));
  try {
    await writeFile(path.join(tempRoot, "index.html"), htmlBody);
    await writeFile(path.join(tempRoot, "qr.png"), qrPng);
    await writeFile(path.join(tempRoot, "print.pdf"), pdfBytes);

    const htmlWrite = await writeVerified(deps.storage, {
      key: htmlKey,
      body: htmlBody,
      contentType: PUBLIC_ARTIFACT_CONTENT_TYPES.html,
      checksum: htmlHash
    });
    const qrWrite = await writeVerified(deps.storage, {
      key: qrKey,
      body: qrPng,
      contentType: PUBLIC_ARTIFACT_CONTENT_TYPES.png,
      checksum: qrHash
    });
    const pdfWrite = await writeVerified(deps.storage, {
      key: pdfKey,
      body: pdfBytes,
      contentType: PUBLIC_ARTIFACT_CONTENT_TYPES.pdf,
      checksum: pdfHash
    });
    await writeVerified(deps.storage, {
      key: experiencePointerKey(project.slug),
      body: new Uint8Array(Buffer.from(htmlWrite.publicUrl, "utf8")),
      contentType: "text/plain; charset=utf-8",
      checksum: sha256Hex(htmlWrite.publicUrl),
      cacheControl: PAGE_POINTER_CACHE_CONTROL
    });

    const result = {
      artifactKey: htmlKey,
      publicUrl: htmlWrite.publicUrl,
      qrUrl: qrWrite.publicUrl,
      pdfUrl: pdfWrite.publicUrl,
      modelUrl,
      targetUrl,
      experienceUrl,
      idempotent: htmlWrite.idempotent && qrWrite.idempotent && pdfWrite.idempotent,
      pipeline: pageRenderPipelineLabel(),
      hashes: { html: htmlHash, qr: qrHash, pdf: pdfHash, bundle: bundleHash }
    };

    await complete({
      jobId: job.id,
      lockToken: job.lockToken,
      artifactHash: bundleHash,
      result
    });

    if (deps.markProject) {
      await deps.markProject(job.projectId, "ready", {
        publicHtmlUrl: htmlWrite.publicUrl,
        publicQrUrl: qrWrite.publicUrl,
        publicPdfUrl: pdfWrite.publicUrl,
        publicExperienceUrl: experienceUrl
      });
    }

    return {
      kind: result.idempotent ? "idempotent" : "written",
      artifactKey: htmlKey,
      artifactHash: bundleHash,
      publicUrl: htmlWrite.publicUrl,
      qrUrl: qrWrite.publicUrl,
      pdfUrl: pdfWrite.publicUrl,
      experienceUrl
    };
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

export async function handlePageRenderJobFailure(
  job: PipelineJob,
  error: unknown,
  fail: typeof failJob = failJob,
  markProject?: PageRenderStageDeps["markProject"]
): Promise<void> {
  if (!job.lockToken) return;
  const message = error instanceof Error ? error.message : String(error);
  const nonRetryable =
    (error instanceof PageRenderError && !error.retryable) ||
    error instanceof PublicStorageConfigError;
  const failed = await fail({
    jobId: job.id,
    lockToken: job.lockToken,
    error: message,
    terminal: nonRetryable
  });
  if (failed.status === "error" && markProject) {
    await markProject(job.projectId, "error");
  }
}
