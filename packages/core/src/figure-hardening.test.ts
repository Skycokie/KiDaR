import { describe, expect, it } from "vitest";
import {
  acceptUploadForProcessing,
  assertFigureImageDimensions,
  assertFigureTransition,
  authorizeFigureRequest,
  buildFigureAuditEvent,
  classifyFigureUpload,
  claimFigureGeneration,
  decideFigureGeneration,
  decideFigurePublish,
  figureIdempotencyKey,
  normalizeFigureUpload,
  stripFailedFigureFields,
  evaluateFigureBudget,
  figureDeliveryForStatus,
  readFigureFeatureFlags,
  redactFigureRecord,
  validateFigureModel,
  FIGURE_GLB_CONTENT_TYPE,
  FIGURE_USDZ_CONTENT_TYPE,
  type FigureModelVerdict,
  type FigureSubmitDecision,
  type FigureUploadVerdict
} from "./figure-hardening";

function rejectCode(decision: FigureSubmitDecision): string {
  if (decision.action !== "reject") throw new Error(decision.action);
  return decision.code;
}

function uploadCode(verdict: FigureUploadVerdict): string {
  if (verdict.ok) throw new Error("expected upload rejection");
  return verdict.code;
}

function modelCode(verdict: FigureModelVerdict): string {
  if (verdict.ok) throw new Error("expected model rejection");
  return verdict.code;
}

const flagsOff = readFigureFeatureFlags({});
const flagsOn = readFigureFeatureFlags({
  FIGURE_GENERATION_ENABLED: "true",
  FIGURE_AR_ENABLED: "true",
  FIGURE_PUBLISH_ENABLED: "true"
});

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0x00]);
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const heic = Uint8Array.from([0, 0, 0, 0x18, ..."ftypheic".split("").map((c) => c.charCodeAt(0))]);
const glb = new Uint8Array([0x67, 0x6c, 0x54, 0x46, 2, 0, 0, 0, 12, 0, 0, 0]);
const usdz = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);

function budget(patch: Partial<Parameters<typeof evaluateFigureBudget>[0]> = {}) {
  return {
    userDay: 0,
    ipDay: 0,
    projectDay: 0,
    day: 0,
    month: 0,
    inFlight: 0,
    spentUsdDay: 0,
    spentUsdMonth: 0,
    recentErrors: 0,
    recentSamples: 0,
    ...patch
  };
}

describe("figure feature flags", () => {
  it("stays off unless the value is exactly true", () => {
    expect(flagsOff).toEqual({ generation: false, ar: false, publish: false });
    expect(readFigureFeatureFlags({ FIGURE_GENERATION_ENABLED: "false" }).generation).toBe(false);
    expect(readFigureFeatureFlags({ FIGURE_GENERATION_ENABLED: "TRUE" }).generation).toBe(false);
    expect(readFigureFeatureFlags({ FIGURE_GENERATION_ENABLED: " TRUE " }).generation).toBe(false);
    expect(readFigureFeatureFlags({ FIGURE_GENERATION_ENABLED: "true " }).generation).toBe(false);
    expect(readFigureFeatureFlags({ FIGURE_GENERATION_ENABLED: "1" }).generation).toBe(false);
    expect(readFigureFeatureFlags({ FIGURE_GENERATION_ENABLED: "yes" }).generation).toBe(false);
    expect(readFigureFeatureFlags({ FIGURE_GENERATION_ENABLED: "true" }).generation).toBe(true);
  });
});

describe("figure lifecycle", () => {
  it("rejects a client marking ready or published", () => {
    expect(() => assertFigureTransition("draft", "ready", "client")).toThrow(/client/);
    expect(() => assertFigureTransition("processing", "published", "client")).toThrow(/client/);
    expect(() => assertFigureTransition("ready", "published", "client")).toThrow(/client/);
    expect(() => assertFigureTransition("processing", "ready", "server")).not.toThrow();
    expect(() => assertFigureTransition("ready", "published", "server")).not.toThrow();
    expect(() => assertFigureTransition("failed", "queued", "server")).not.toThrow();
    expect(() => assertFigureTransition("published", "ready", "server")).toThrow(/server/);
  });
});

describe("figure idempotency", () => {
  const base = {
    flags: flagsOn,
    projectId: "proj",
    drawingVersion: "file-1",
    requesterId: "user-1",
    ownerId: "user-1",
    proposedJobId: "new-job"
  };

  it("does not start a second job for the same drawing", () => {
    const first = decideFigureGeneration({ ...base, existing: null });
    expect(first).toMatchObject({ action: "start", jobId: "new-job" });
    const again = decideFigureGeneration({
      ...base,
      existing: { jobId: "job-1", status: "processing", drawingVersion: "file-1" }
    });
    expect(again).toMatchObject({ action: "resume", jobId: "job-1" });
  });

  it("reuses a ready asset and blocks a new drawing while one is in flight", () => {
    expect(
      decideFigureGeneration({
        ...base,
        flags: flagsOff,
        existing: { jobId: "job-1", status: "ready", drawingVersion: null }
      })
    ).toMatchObject({ action: "reuse", jobId: "job-1" });
    expect(
      decideFigureGeneration({
        ...base,
        drawingVersion: "file-2",
        existing: { jobId: "job-1", status: "processing", drawingVersion: "file-1" }
      }).action
    ).toBe("reject");
  });

  it("resumes a failed job instead of allocating a new one", () => {
    expect(
      decideFigureGeneration({
        ...base,
        existing: { jobId: "job-1", status: "failed", drawingVersion: "file-1" }
      })
    ).toMatchObject({ action: "resume", jobId: "job-1" });
  });

  it("rejects generation when the flag is off, the caller is not the owner, or the budget is closed", () => {
    expect(rejectCode(decideFigureGeneration({ ...base, flags: flagsOff, existing: null }))).toBe(
      "flag_off"
    );
    expect(rejectCode(decideFigureGeneration({ ...base, requesterId: "other", existing: null }))).toBe(
      "unauthorized"
    );
    expect(rejectCode(decideFigureGeneration({ ...base, existing: null, circuitOpen: true }))).toBe(
      "circuit"
    );
    expect(rejectCode(decideFigureGeneration({ ...base, existing: null, budgetAllowed: false }))).toBe(
      "budget"
    );
  });

  it("uses project, drawing version, and pipeline in one key, and reserves a single job", () => {
    expect(figureIdempotencyKey("proj", "file-1")).toBe("proj:file-1:figurine-tripo-v2");
    const held = new Map<string, string>();
    const first = claimFigureGeneration({ ...base, proposedJobId: "job-a", existing: null }, held);
    const second = claimFigureGeneration({ ...base, proposedJobId: "job-b", existing: null }, held);
    expect(first).toMatchObject({ action: "start", jobId: "job-a" });
    expect(second).toMatchObject({ action: "resume", jobId: "job-a" });
  });
});

describe("figure upload validation", () => {
  it("accepts jpeg, png, and heic by magic bytes", () => {
    expect(classifyFigureUpload(jpeg)).toMatchObject({ ok: true, mime: "image/jpeg" });
    expect(classifyFigureUpload(png, "image/png")).toMatchObject({ ok: true, mime: "image/png" });
    expect(classifyFigureUpload(heic)).toMatchObject({
      ok: true,
      mime: "image/heic",
      requiresServerConversion: true
    });
  });

  it("rejects svg, html, pdf, executables, archives, and a mismatched mime", () => {
    const text = (value: string) => Uint8Array.from(value, (c) => c.charCodeAt(0));
    expect(uploadCode(classifyFigureUpload(text("<svg xmlns='x'></svg>")))).toBe("rejected_type");
    expect(uploadCode(classifyFigureUpload(text("<!DOCTYPE html><html></html>")))).toBe("rejected_type");
    expect(uploadCode(classifyFigureUpload(text("%PDF-1.7")))).toBe("rejected_type");
    expect(uploadCode(classifyFigureUpload(new Uint8Array([0x4d, 0x5a, 0x00])))).toBe("rejected_type");
    expect(uploadCode(classifyFigureUpload(new Uint8Array([0x50, 0x4b, 0x03, 0x04])))).toBe(
      "rejected_type"
    );
    expect(uploadCode(classifyFigureUpload(jpeg, "image/png"))).toBe("mime_mismatch");
  });

  it("enforces dimensions and metadata stripping", () => {
    expect(assertFigureImageDimensions(8000, 8000).ok).toBe(false);
    expect(assertFigureImageDimensions(1024, 1024).ok).toBe(true);
    const verdict = classifyFigureUpload(jpeg);
    expect(uploadCode(acceptUploadForProcessing({ verdict, metadataStripped: false }))).toBe(
      "not_normalized"
    );
    const heicVerdict = classifyFigureUpload(heic);
    expect(
      uploadCode(
        acceptUploadForProcessing({ verdict: heicVerdict, metadataStripped: true, heicConverted: false })
      )
    ).toBe("not_normalized");
    expect(acceptUploadForProcessing({ verdict, metadataStripped: true }).ok).toBe(true);
  });

  it("strips jpeg metadata and refuses heic until it is converted", () => {
    const app1 = Uint8Array.from([0xff, 0xe1, 0x00, 0x08, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00]);
    const sof = Uint8Array.from([
      0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x10, 0x00, 0x10, 0x01, 0x01, 0x11, 0x00
    ]);
    const sos = Uint8Array.from([0xff, 0xda, 0x00, 0x02, 0xff, 0xd9]);
    const raw = new Uint8Array(2 + app1.length + sof.length + sos.length);
    raw.set([0xff, 0xd8], 0);
    raw.set(app1, 2);
    raw.set(sof, 2 + app1.length);
    raw.set(sos, 2 + app1.length + sof.length);
    const normalized = normalizeFigureUpload(raw);
    expect(normalized.ok).toBe(true);
    if (normalized.ok) {
      expect(normalized.bytes.includes(0xe1)).toBe(false);
      expect(normalized.mime).toBe("image/jpeg");
    }
    expect(normalizeFigureUpload(heic).ok).toBe(false);
  });
});

describe("figure 3d validation", () => {
  it("requires the fixed mime types and magic bytes", () => {
    expect(
      validateFigureModel({ kind: "glb", bytes: glb, contentType: FIGURE_GLB_CONTENT_TYPE }).ok
    ).toBe(true);
    expect(
      validateFigureModel({ kind: "usdz", bytes: usdz, contentType: FIGURE_USDZ_CONTENT_TYPE }).ok
    ).toBe(true);
    expect(modelCode(validateFigureModel({ kind: "glb", bytes: glb, contentType: "model/gltf+json" }))).toBe(
      "mime"
    );
    expect(
      modelCode(
        validateFigureModel({
          kind: "glb",
          bytes: glb,
          contentType: FIGURE_GLB_CONTENT_TYPE,
          triangles: 60_000
        })
      )
    ).toBe("polygons");
  });

  it("does not attach keys when the job failed", () => {
    const glbOk = validateFigureModel({ kind: "glb", bytes: glb, contentType: FIGURE_GLB_CONTENT_TYPE });
    const usdzOk = validateFigureModel({
      kind: "usdz",
      bytes: usdz,
      contentType: FIGURE_USDZ_CONTENT_TYPE
    });
    expect(
      figureDeliveryForStatus({ status: "failed", glb: glbOk, usdz: usdzOk, glbKey: "a", usdzKey: "b" })
    ).toEqual({ status: "failed" });
    expect(() =>
      figureDeliveryForStatus({
        status: "ready",
        glb: { ok: false, code: "magic" },
        usdz: usdzOk
      })
    ).toThrow(/validated/);
  });
});

describe("figure access, budget, audit, and publish", () => {
  it("rejects a caller who does not own the project", () => {
    const denied = authorizeFigureRequest({
      requesterId: "other",
      ownerId: "user-1",
      projectId: "proj",
      assetProjectId: "proj"
    });
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.code).toBe("unauthorized");
    const foreign = authorizeFigureRequest({
      requesterId: "user-1",
      ownerId: "user-1",
      projectId: "proj",
      assetProjectId: "other"
    });
    expect(foreign.ok).toBe(false);
    if (!foreign.ok) expect(foreign.code).toBe("foreign_asset");
  });

  it("does not keep presigned URLs in stored records or audit events", () => {
    expect(
      redactFigureRecord({
        jobId: "job-1",
        presignedUrl: "https://example.test/secret",
        note: "https://example.test/file"
      })
    ).toEqual({ jobId: "job-1" });
    const event = buildFigureAuditEvent({
      name: "asset_signed",
      jobId: "job-1",
      environment: "staging",
      resultCode: "ok",
      extra: { presignedUrl: "https://example.test/secret", drawing: "raw" }
    });
    expect(JSON.stringify(event)).not.toContain("https://");
    expect(JSON.stringify(event)).not.toContain("raw");
    expect(
      stripFailedFigureFields({
        jobId: "job-1",
        glbKey: "staging/projects/p/figures/j/model.glb",
        usdzKey: "staging/projects/p/figures/j/model.usdz",
        publicUrl: "https://example.test/model.usdz",
        status: "failed"
      })
    ).toEqual({ jobId: "job-1", status: "failed" });
    expect(event).toEqual({
      name: "asset_signed",
      jobId: "job-1",
      environment: "staging",
      resultCode: "ok"
    });
  });

  it("opens the circuit and denies publish while flags are off", () => {
    const circuit = evaluateFigureBudget(budget({ recentErrors: 3, recentSamples: 4 }));
    const rate = evaluateFigureBudget(budget({ userDay: 3 }));
    const concurrency = evaluateFigureBudget(budget({ inFlight: 1 }));
    expect(circuit.allowed).toBe(false);
    expect(rate.allowed).toBe(false);
    expect(concurrency.allowed).toBe(false);
    if (!circuit.allowed) expect(circuit.code).toBe("circuit");
    if (!rate.allowed) expect(rate.code).toBe("rate");
    if (!concurrency.allowed) expect(concurrency.code).toBe("concurrency");
    expect(
      decideFigurePublish({
        flags: flagsOff,
        requesterId: "user-1",
        ownerId: "user-1",
        allowlisted: true,
        status: "ready",
        withinLimits: true,
        termsAccepted: true
      })
    ).toEqual({ allowed: false, code: "flag_off" });
    expect(
      decideFigurePublish({
        flags: flagsOn,
        requesterId: "user-1",
        ownerId: "user-1",
        allowlisted: true,
        status: "ready",
        withinLimits: true,
        termsAccepted: true
      }).allowed
    ).toBe(true);
  });
});
