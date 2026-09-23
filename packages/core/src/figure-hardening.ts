/**
 * B0 production hardening for figure generation.
 * Flags default off. Nothing here publishes, signs, or starts a provider job.
 * The internal staging viewer stays on its own runtime gate.
 */

import {
  FIGURINE_MAX_GLB_BYTES,
  FIGURINE_MAX_SOURCE_BYTES,
  FIGURINE_MAX_TRIANGLES,
  FIGURINE_MAX_VERTICES,
  FIGURINE_PIPELINE_VERSION
} from "./figurine";
import { FIGURE_STAGING_MAX_USDZ_BYTES } from "./figure-staging";

export const FIGURE_FLAG_GENERATION = "FIGURE_GENERATION_ENABLED";
export const FIGURE_FLAG_AR = "FIGURE_AR_ENABLED";
export const FIGURE_FLAG_PUBLISH = "FIGURE_PUBLISH_ENABLED";

export const FIGURE_GLB_CONTENT_TYPE = "model/gltf-binary";
export const FIGURE_USDZ_CONTENT_TYPE = "model/vnd.usdz+zip";

export const FIGURE_MAX_UPLOAD_BYTES = FIGURINE_MAX_SOURCE_BYTES;
export const FIGURE_MAX_EDGE_PX = 8192;
export const FIGURE_MAX_PIXELS = 16_000_000;
export const FIGURE_MAX_TEXTURE_BYTES = 8 * 1024 * 1024;

/** Product lifecycle. Distinct from the staging asset status stored for the internal viewer. */
export const FIGURE_LIFECYCLE = [
  "draft",
  "queued",
  "processing",
  "ready",
  "published",
  "failed",
  "cancelled"
] as const;

export type FigureLifecycle = (typeof FIGURE_LIFECYCLE)[number];

export type FigureActor = "client" | "server";

const SERVER_EDGES: Record<FigureLifecycle, ReadonlySet<FigureLifecycle>> = {
  draft: new Set(["queued", "cancelled"]),
  queued: new Set(["processing", "failed", "cancelled"]),
  processing: new Set(["ready", "failed", "cancelled"]),
  ready: new Set(["published", "failed", "cancelled"]),
  published: new Set(),
  failed: new Set(["queued"]),
  cancelled: new Set()
};

/** A client may ask to queue or cancel. It cannot mark ready or published. */
const CLIENT_EDGES: Record<FigureLifecycle, ReadonlySet<FigureLifecycle>> = {
  draft: new Set(["queued", "cancelled"]),
  queued: new Set(["cancelled"]),
  processing: new Set(["cancelled"]),
  ready: new Set(),
  published: new Set(),
  failed: new Set(),
  cancelled: new Set()
};

export type FigureFeatureFlags = {
  generation: boolean;
  ar: boolean;
  publish: boolean;
};

/** Only the exact characters true. TRUE, whitespace, 1, and yes stay off. */
export function isExplicitTrue(value: string | undefined | null): boolean {
  return value === "true";
}

export function readFigureFeatureFlags(
  env: Record<string, string | undefined>
): FigureFeatureFlags {
  return {
    generation: isExplicitTrue(env[FIGURE_FLAG_GENERATION]),
    ar: isExplicitTrue(env[FIGURE_FLAG_AR]),
    publish: isExplicitTrue(env[FIGURE_FLAG_PUBLISH])
  };
}

export function isFigureLifecycle(value: string): value is FigureLifecycle {
  return (FIGURE_LIFECYCLE as readonly string[]).includes(value);
}

export function canFigureTransition(
  from: FigureLifecycle,
  to: FigureLifecycle,
  actor: FigureActor
): boolean {
  const edges = actor === "client" ? CLIENT_EDGES : SERVER_EDGES;
  return edges[from].has(to);
}

export function assertFigureTransition(
  from: FigureLifecycle,
  to: FigureLifecycle,
  actor: FigureActor
): void {
  if (!canFigureTransition(from, to, actor)) {
    throw new Error(`Illegal figure transition for ${actor}: ${from} → ${to}`);
  }
}

export type FigureJobSnapshot = {
  jobId: string;
  status: FigureLifecycle;
  /** Null when an older record has no stored drawing version. */
  drawingVersion: string | null;
};

export type FigureSubmitDecision =
  | { action: "start" | "resume" | "reuse"; jobId: string; idempotencyKey: string }
  | { action: "reject"; code: "flag_off" | "in_flight" | "unauthorized" | "budget" | "circuit" };

export function figureIdempotencyKey(
  projectId: string,
  drawingVersion: string,
  pipelineVersion = FIGURINE_PIPELINE_VERSION
): string {
  const project = projectId.trim();
  const version = drawingVersion.trim();
  const pipeline = pipelineVersion.trim();
  if (
    !project ||
    !version ||
    !pipeline ||
    project.includes("..") ||
    version.includes("..") ||
    pipeline.includes("..")
  ) {
    throw new Error("Invalid figure idempotency input");
  }
  return `${project}:${version}:${pipeline}`;
}

/**
 * One generation per project + drawing version.
 * A second submit resumes or reuses the same job. It does not allocate a new provider job.
 */
export function decideFigureGeneration(input: {
  flags: FigureFeatureFlags;
  projectId: string;
  drawingVersion: string;
  requesterId: string;
  ownerId: string;
  existing: FigureJobSnapshot | null;
  proposedJobId: string;
  pipelineVersion?: string;
  budgetAllowed?: boolean;
  circuitOpen?: boolean;
}): FigureSubmitDecision {
  if (!input.requesterId || input.requesterId !== input.ownerId) {
    return { action: "reject", code: "unauthorized" };
  }
  const idempotencyKey = figureIdempotencyKey(
    input.projectId,
    input.drawingVersion,
    input.pipelineVersion
  );
  const existing = input.existing;

  if (
    existing &&
    (existing.status === "ready" || existing.status === "published") &&
    (existing.drawingVersion === null || existing.drawingVersion === input.drawingVersion)
  ) {
    return { action: "reuse", jobId: existing.jobId, idempotencyKey };
  }

  if (input.circuitOpen) return { action: "reject", code: "circuit" };
  if (input.budgetAllowed === false) return { action: "reject", code: "budget" };
  if (!input.flags.generation) return { action: "reject", code: "flag_off" };

  if (existing && (existing.status === "queued" || existing.status === "processing")) {
    if (existing.drawingVersion && existing.drawingVersion !== input.drawingVersion) {
      return { action: "reject", code: "in_flight" };
    }
    return { action: "resume", jobId: existing.jobId, idempotencyKey };
  }

  if (existing && existing.status === "failed") {
    if (existing.drawingVersion && existing.drawingVersion !== input.drawingVersion) {
      return { action: "start", jobId: input.proposedJobId, idempotencyKey };
    }
    return { action: "resume", jobId: existing.jobId, idempotencyKey };
  }

  return { action: "start", jobId: input.proposedJobId, idempotencyKey };
}

/**
 * Second caller for the same key observes the job the first caller just reserved.
 * The map is the stand-in for the server-side job row used by the route and worker.
 */
export function claimFigureGeneration(
  input: Parameters<typeof decideFigureGeneration>[0],
  held: Map<string, string>
): FigureSubmitDecision {
  const decision = decideFigureGeneration(input);
  if (decision.action !== "start") return decision;
  const reserved = held.get(decision.idempotencyKey);
  if (reserved) {
    return { action: "resume", jobId: reserved, idempotencyKey: decision.idempotencyKey };
  }
  held.set(decision.idempotencyKey, decision.jobId);
  return decision;
}

export type FigureUploadVerdict =
  | {
      ok: true;
      mime: "image/jpeg" | "image/png" | "image/heic";
      requiresServerConversion: boolean;
    }
  | { ok: false; code: "empty" | "too_large" | "rejected_type" | "mime_mismatch" | "dimensions" | "not_normalized" };

const JPEG = [0xff, 0xd8, 0xff];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function startsWith(bytes: Uint8Array, magic: number[]): boolean {
  if (bytes.byteLength < magic.length) return false;
  return magic.every((value, index) => bytes[index] === value);
}

function asciiAt(bytes: Uint8Array, offset: number, text: string): boolean {
  if (bytes.byteLength < offset + text.length) return false;
  for (let i = 0; i < text.length; i += 1) {
    if (bytes[offset + i] !== text.charCodeAt(i)) return false;
  }
  return true;
}

function isHeic(bytes: Uint8Array): boolean {
  if (!asciiAt(bytes, 4, "ftyp")) return false;
  const brand = String.fromCharCode(...bytes.slice(8, 12));
  return brand === "heic" || brand === "heif" || brand === "mif1" || brand === "heix";
}

function isRejectedContainer(bytes: Uint8Array): boolean {
  const head = String.fromCharCode(...bytes.slice(0, Math.min(bytes.byteLength, 64)))
    .trimStart()
    .toLowerCase();
  if (head.startsWith("<svg") || head.startsWith("<?xml") || head.startsWith("<!doctype")) return true;
  if (head.startsWith("<html") || head.startsWith("<script")) return true;
  if (asciiAt(bytes, 0, "%PDF")) return true;
  if (bytes[0] === 0x4d && bytes[1] === 0x5a) return true;
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) return true;
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) return true;
  return false;
}

export function classifyFigureUpload(
  bytes: Uint8Array,
  declaredMime?: string | null
): FigureUploadVerdict {
  if (!bytes.byteLength) return { ok: false, code: "empty" };
  if (bytes.byteLength > FIGURE_MAX_UPLOAD_BYTES) return { ok: false, code: "too_large" };
  if (isRejectedContainer(bytes)) return { ok: false, code: "rejected_type" };

  let mime: "image/jpeg" | "image/png" | "image/heic" | null = null;
  if (startsWith(bytes, JPEG)) mime = "image/jpeg";
  else if (startsWith(bytes, PNG)) mime = "image/png";
  else if (isHeic(bytes)) mime = "image/heic";
  if (!mime) return { ok: false, code: "rejected_type" };

  if (declaredMime && declaredMime.trim().toLowerCase() !== mime) {
    return { ok: false, code: "mime_mismatch" };
  }
  return { ok: true, mime, requiresServerConversion: mime === "image/heic" };
}

export function assertFigureImageDimensions(width: number, height: number): FigureUploadVerdict | { ok: true } {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width < 1 ||
    height < 1 ||
    width > FIGURE_MAX_EDGE_PX ||
    height > FIGURE_MAX_EDGE_PX ||
    width * height > FIGURE_MAX_PIXELS
  ) {
    return { ok: false, code: "dimensions" };
  }
  return { ok: true };
}

function u16(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function u32(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset] * 0x1000000 +
      (bytes[offset + 1] << 16) +
      (bytes[offset + 2] << 8) +
      bytes[offset + 3]) >>>
    0
  );
}

/** Header-only dimensions. Does not decode pixels. */
export function readRasterDimensions(
  bytes: Uint8Array,
  mime: "image/jpeg" | "image/png" | "image/heic"
): { width: number; height: number } | null {
  if (mime === "image/png") {
    if (bytes.byteLength < 24) return null;
    return { width: u32(bytes, 16), height: u32(bytes, 20) };
  }
  if (mime === "image/heic") return null;
  if (bytes.byteLength < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  const limit = Math.min(bytes.byteLength, 1024 * 1024);
  while (offset + 8 < limit) {
    if (bytes[offset] !== 0xff) return null;
    const marker = bytes[offset + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) return null;
    const length = u16(bytes, offset + 2);
    if (length < 2 || offset + 2 + length > bytes.byteLength) return null;
    if (marker >= 0xc0 && marker <= 0xc3) {
      return { height: u16(bytes, offset + 5), width: u16(bytes, offset + 7) };
    }
    offset += 2 + length;
  }
  return null;
}

const PNG_KEEP = new Set(["IHDR", "PLTE", "IDAT", "IEND", "tRNS"]);

function chunkType(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
}

/** Drop JPEG APP/COM and PNG text metadata. HEIC is not converted here. */
export function normalizeFigureUpload(
  bytes: Uint8Array
):
  | { ok: true; mime: "image/jpeg" | "image/png"; bytes: Uint8Array }
  | {
      ok: false;
      code: "empty" | "too_large" | "rejected_type" | "mime_mismatch" | "dimensions" | "not_normalized";
    } {
  const classified = classifyFigureUpload(bytes);
  if (!classified.ok) return classified;
  if (classified.mime === "image/heic") return { ok: false, code: "not_normalized" };
  const size = readRasterDimensions(bytes, classified.mime);
  if (!size) return { ok: false, code: "dimensions" };
  const dims = assertFigureImageDimensions(size.width, size.height);
  if (!dims.ok) return { ok: false, code: "dimensions" };

  if (classified.mime === "image/png") {
    const parts: Uint8Array[] = [bytes.slice(0, 8)];
    let offset = 8;
    while (offset + 12 <= bytes.byteLength) {
      const length = u32(bytes, offset);
      const end = offset + 12 + length;
      if (end > bytes.byteLength) return { ok: false, code: "rejected_type" };
      const type = chunkType(bytes, offset + 4);
      if (PNG_KEEP.has(type)) parts.push(bytes.slice(offset, end));
      offset = end;
      if (type === "IEND") break;
    }
    return { ok: true, mime: "image/png", bytes: concatBytes(parts) };
  }

  const parts: Uint8Array[] = [bytes.slice(0, 2)];
  let offset = 2;
  while (offset + 4 <= bytes.byteLength) {
    if (bytes[offset] !== 0xff) return { ok: false, code: "rejected_type" };
    const marker = bytes[offset + 1];
    if (marker === 0xda) {
      parts.push(bytes.slice(offset));
      return { ok: true, mime: "image/jpeg", bytes: concatBytes(parts) };
    }
    if (marker === 0xd9) break;
    const length = u16(bytes, offset + 2);
    const end = offset + 2 + length;
    if (length < 2 || end > bytes.byteLength) return { ok: false, code: "rejected_type" };
    const drop = (marker >= 0xe0 && marker <= 0xef) || marker === 0xfe;
    if (!drop) parts.push(bytes.slice(offset, end));
    offset = end;
  }
  return { ok: false, code: "rejected_type" };
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.byteLength;
  }
  return out;
}

const ASSET_FIELD = /^(glbKey|usdzKey|posterKey|publicUrl|modelUrl|figurineModelUrl|presignedUrl|sourceUrl)$/i;

/** Failed status must not keep asset keys or URLs. */
export function stripFailedFigureFields(record: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (ASSET_FIELD.test(key) || SECRET_KEY.test(key)) continue;
    if (typeof value === "string" && /^https?:\/\//i.test(value)) continue;
    out[key] = value;
  }
  return out;
}

/** Processing refuses bytes that have not been normalized and, for HEIC, converted. */
export function acceptUploadForProcessing(input: {
  verdict: FigureUploadVerdict;
  metadataStripped: boolean;
  heicConverted?: boolean;
}): FigureUploadVerdict {
  if (!input.verdict.ok) return input.verdict;
  if (!input.metadataStripped) return { ok: false, code: "not_normalized" };
  if (input.verdict.requiresServerConversion && !input.heicConverted) {
    return { ok: false, code: "not_normalized" };
  }
  return input.verdict;
}

export type FigureModelKind = "glb" | "usdz";

export type FigureModelVerdict =
  | { ok: true; kind: FigureModelKind; contentType: string }
  | { ok: false; code: "empty" | "too_large" | "magic" | "mime" | "polygons" | "textures" | "dimensions" };

export function isGlbBytes(bytes: Uint8Array): boolean {
  return (
    bytes.byteLength >= 12 &&
    bytes[0] === 0x67 &&
    bytes[1] === 0x6c &&
    bytes[2] === 0x54 &&
    bytes[3] === 0x46
  );
}

export function isUsdzBytes(bytes: Uint8Array): boolean {
  return bytes.byteLength >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;
}

export function validateFigureModel(input: {
  kind: FigureModelKind;
  bytes: Uint8Array;
  contentType: string;
  triangles?: number;
  vertices?: number;
  textureBytes?: number;
  maxDimensionMeters?: number;
}): FigureModelVerdict {
  if (!input.bytes.byteLength) return { ok: false, code: "empty" };
  const expected =
    input.kind === "glb" ? FIGURE_GLB_CONTENT_TYPE : FIGURE_USDZ_CONTENT_TYPE;
  if (input.contentType !== expected) return { ok: false, code: "mime" };
  const limit = input.kind === "glb" ? FIGURINE_MAX_GLB_BYTES : FIGURE_STAGING_MAX_USDZ_BYTES;
  if (input.bytes.byteLength > limit) return { ok: false, code: "too_large" };
  const magicOk = input.kind === "glb" ? isGlbBytes(input.bytes) : isUsdzBytes(input.bytes);
  if (!magicOk) return { ok: false, code: "magic" };
  if (
    (input.triangles !== undefined && input.triangles > FIGURINE_MAX_TRIANGLES) ||
    (input.vertices !== undefined && input.vertices > FIGURINE_MAX_VERTICES)
  ) {
    return { ok: false, code: "polygons" };
  }
  if (input.textureBytes !== undefined && input.textureBytes > FIGURE_MAX_TEXTURE_BYTES) {
    return { ok: false, code: "textures" };
  }
  if (input.maxDimensionMeters !== undefined && input.maxDimensionMeters > 5) {
    return { ok: false, code: "dimensions" };
  }
  return { ok: true, kind: input.kind, contentType: expected };
}

/** Ready requires both validated models. A failed job carries no URLs and no keys. */
export function figureDeliveryForStatus(input: {
  status: FigureLifecycle;
  glb: FigureModelVerdict;
  usdz: FigureModelVerdict;
  glbKey?: string;
  usdzKey?: string;
}): { status: FigureLifecycle; glbKey?: string; usdzKey?: string; urls?: never } {
  if (input.status === "ready" || input.status === "published") {
    if (!input.glb.ok || !input.usdz.ok || !input.glbKey || !input.usdzKey) {
      throw new Error("Figure cannot become ready without validated GLB and USDZ");
    }
    return { status: input.status, glbKey: input.glbKey, usdzKey: input.usdzKey };
  }
  return { status: input.status };
}

export function authorizeFigureRequest(input: {
  requesterId: string | null | undefined;
  ownerId: string | null | undefined;
  projectId: string;
  assetProjectId: string;
}): { ok: true } | { ok: false; code: "unauthorized" | "foreign_asset" } {
  if (!input.requesterId || !input.ownerId || input.requesterId !== input.ownerId) {
    return { ok: false, code: "unauthorized" };
  }
  if (input.projectId !== input.assetProjectId) {
    return { ok: false, code: "foreign_asset" };
  }
  return { ok: true };
}

const SECRET_KEY = /url|token|secret|cookie|presign|authorization|api[-_]?key|password|bytes|image|drawing/i;

/** Drop anything that could persist a presigned URL, credential, or drawing. */
export function redactFigureRecord(record: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (SECRET_KEY.test(key)) continue;
    if (typeof value === "string" && /^https?:\/\//i.test(value)) continue;
    out[key] = value;
  }
  return out;
}

export const FIGURE_LIMITS = {
  perUserPerDay: 3,
  perIpPerDay: 10,
  perProjectPerDay: 3,
  perDay: 25,
  perMonth: 200,
  maxConcurrent: 1,
  maxDailySpendUsd: 25,
  maxMonthlySpendUsd: 200,
  circuitErrorRate: 0.5,
  circuitMinSamples: 4
} as const;

export type FigureBudgetSnapshot = {
  userDay: number;
  ipDay: number;
  projectDay: number;
  day: number;
  month: number;
  inFlight: number;
  spentUsdDay: number;
  spentUsdMonth: number;
  recentErrors: number;
  recentSamples: number;
};

export function evaluateFigureBudget(
  snapshot: FigureBudgetSnapshot
): { allowed: true } | { allowed: false; code: "rate" | "concurrency" | "spend" | "circuit" } {
  const errorRate =
    snapshot.recentSamples > 0 ? snapshot.recentErrors / snapshot.recentSamples : 0;
  if (
    snapshot.recentSamples >= FIGURE_LIMITS.circuitMinSamples &&
    errorRate >= FIGURE_LIMITS.circuitErrorRate
  ) {
    return { allowed: false, code: "circuit" };
  }
  if (snapshot.inFlight >= FIGURE_LIMITS.maxConcurrent) {
    return { allowed: false, code: "concurrency" };
  }
  if (
    snapshot.userDay >= FIGURE_LIMITS.perUserPerDay ||
    snapshot.ipDay >= FIGURE_LIMITS.perIpPerDay ||
    snapshot.projectDay >= FIGURE_LIMITS.perProjectPerDay ||
    snapshot.day >= FIGURE_LIMITS.perDay ||
    snapshot.month >= FIGURE_LIMITS.perMonth
  ) {
    return { allowed: false, code: "rate" };
  }
  if (
    snapshot.spentUsdDay >= FIGURE_LIMITS.maxDailySpendUsd ||
    snapshot.spentUsdMonth >= FIGURE_LIMITS.maxMonthlySpendUsd
  ) {
    return { allowed: false, code: "spend" };
  }
  return { allowed: true };
}

export const FIGURE_AUDIT_EVENTS = [
  "job_created",
  "job_started",
  "job_ready",
  "job_failed",
  "asset_signed",
  "quicklook_opened",
  "publish_requested",
  "publish_succeeded",
  "publish_denied"
] as const;

export type FigureAuditEventName = (typeof FIGURE_AUDIT_EVENTS)[number];

export type FigureAuditEvent = {
  name: FigureAuditEventName;
  jobId: string;
  environment: string;
  resultCode: string;
};

export function buildFigureAuditEvent(input: {
  name: FigureAuditEventName;
  jobId: string;
  environment: string;
  resultCode: string;
  extra?: Record<string, unknown>;
}): FigureAuditEvent {
  const extra = redactFigureRecord(input.extra ?? {});
  void extra;
  return {
    name: input.name,
    jobId: input.jobId,
    environment: input.environment,
    resultCode: input.resultCode
  };
}

export type FigurePublishDecision =
  | { allowed: true }
  | {
      allowed: false;
      code:
        | "flag_off"
        | "not_allowlisted"
        | "unauthorized"
        | "not_ready"
        | "limits"
        | "terms";
    };

/** UI cannot publish. The server allows it only when every gate passes. */
export function decideFigurePublish(input: {
  flags: FigureFeatureFlags;
  requesterId: string;
  ownerId: string;
  allowlisted: boolean;
  status: FigureLifecycle;
  withinLimits: boolean;
  termsAccepted: boolean;
}): FigurePublishDecision {
  if (!input.flags.publish) return { allowed: false, code: "flag_off" };
  if (!input.allowlisted) return { allowed: false, code: "not_allowlisted" };
  if (!input.requesterId || input.requesterId !== input.ownerId) {
    return { allowed: false, code: "unauthorized" };
  }
  if (input.status !== "ready") return { allowed: false, code: "not_ready" };
  if (!input.withinLimits) return { allowed: false, code: "limits" };
  if (!input.termsAccepted) return { allowed: false, code: "terms" };
  return { allowed: true };
}
