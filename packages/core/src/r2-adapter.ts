/**
 * R2-backed public artifact storage. S3 I/O is injected so tests never use credentials.
 * This adapter never lists buckets, never deletes, and never signs URLs.
 */

import type {
  PublicArtifactMetadata,
  PublicArtifactStorage,
  PublicArtifactWriteInput,
  R2PublicStorageConfig
} from "./storage";
import { PublicStorageConfigError } from "./storage-error";
import {
  IMMUTABLE_CACHE_CONTROL,
  normalizePublicObjectKey,
  publicArtifactUrl
} from "./storage-keys";

export interface R2ObjectHead {
  size?: number;
  contentType?: string;
  checksum?: string;
  cacheControl?: string;
  updatedAt?: string;
}

export interface R2ObjectStore {
  put(input: {
    key: string;
    body: Uint8Array;
    contentType: string;
    cacheControl: string;
    checksum?: string;
  }): Promise<void>;
  /** Return null only for missing objects; other failures must throw. */
  head(key: string): Promise<R2ObjectHead | null>;
}

export class MemoryR2ObjectStore implements R2ObjectStore {
  readonly objects = new Map<
    string,
    { body: Uint8Array; contentType: string; cacheControl: string; checksum?: string }
  >();

  lastError: Error | null = null;

  async put(input: {
    key: string;
    body: Uint8Array;
    contentType: string;
    cacheControl: string;
    checksum?: string;
  }): Promise<void> {
    if (this.lastError) throw this.lastError;
    this.objects.set(input.key, { ...input });
  }

  async head(key: string): Promise<R2ObjectHead | null> {
    if (this.lastError) throw this.lastError;
    const hit = this.objects.get(key);
    if (!hit) return null;
    return {
      size: hit.body.byteLength,
      contentType: hit.contentType,
      checksum: hit.checksum,
      cacheControl: hit.cacheControl
    };
  }
}

export class R2PublicArtifactStorage implements PublicArtifactStorage {
  readonly provider = "r2" as const;

  constructor(
    private readonly config: R2PublicStorageConfig,
    private readonly store: R2ObjectStore
  ) {
    if (config.provider !== "r2") {
      throw new PublicStorageConfigError("R2PublicArtifactStorage requires provider r2.");
    }
  }

  getPublicUrl(key: string): string {
    return publicArtifactUrl(this.config.publicBaseUrl, key);
  }

  async exists(key: string): Promise<boolean> {
    const meta = await this.getMetadata(key);
    return meta !== null;
  }

  async getMetadata(key: string): Promise<PublicArtifactMetadata | null> {
    const normalized = normalizePublicObjectKey(key);
    const head = await this.store.head(normalized);
    if (!head) return null;
    return {
      key: normalized,
      size: head.size,
      contentType: head.contentType,
      checksum: head.checksum,
      updatedAt: head.updatedAt
    };
  }

  async write(input: PublicArtifactWriteInput): Promise<{ key: string; publicUrl: string }> {
    const key = normalizePublicObjectKey(input.key);
    if (!input.body || input.body.byteLength === 0) {
      throw new PublicStorageConfigError("Public artifact body is empty.");
    }
    if (!input.contentType || !input.contentType.trim()) {
      throw new PublicStorageConfigError("contentType is required for public artifact writes.");
    }
    const cacheControl = input.cacheControl?.trim() || IMMUTABLE_CACHE_CONTROL;
    await this.store.put({
      key,
      body: input.body,
      contentType: input.contentType.trim(),
      cacheControl,
      checksum: input.checksum
    });
    return { key, publicUrl: this.getPublicUrl(key) };
  }
}
