import { Permission, Role } from "node-appwrite";
import { InputFile } from "node-appwrite/file";
import {
  APPWRITE_ASSETS_BUCKET,
  APPWRITE_SOURCE_BUCKET
} from "./config";
import { createSessionClient } from "./client";

export function previewUrl(bucketId: string, fileId: string) {
  return `/api/files/${encodeURIComponent(bucketId)}/${encodeURIComponent(fileId)}`;
}

export async function createSignedSourceUrl(fileId: string, _ttlSeconds = 900) {
  return previewUrl(APPWRITE_SOURCE_BUCKET, fileId);
}

export async function createSignedAssetUrl(fileId: string, _ttlSeconds = 900) {
  return previewUrl(APPWRITE_ASSETS_BUCKET, fileId);
}

async function upsertFile(
  bucketId: string,
  preferredId: string,
  file: File,
  ownerId: string
) {
  const { storage } = createSessionClient();
  const buffer = Buffer.from(await file.arrayBuffer());
  const input = InputFile.fromBuffer(buffer, file.name || preferredId);
  const permissions = [
    Permission.read(Role.user(ownerId)),
    Permission.update(Role.user(ownerId)),
    Permission.delete(Role.user(ownerId))
  ];

  try {
    await storage.getFile(bucketId, preferredId);
    await storage.deleteFile(bucketId, preferredId);
  } catch {
    // File does not exist yet.
  }

  const created = await storage.createFile(bucketId, preferredId, input, permissions);
  return created.$id;
}

export function sourceFileId(_ownerId: string, projectId: string) {
  return `src_${projectId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 32)}`;
}

export function assetFileId(projectId: string, kind: string) {
  return `${kind}_${projectId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 32)}`.slice(0, 36);
}

export async function uploadSourceDrawing(ownerId: string, projectId: string, file: File) {
  const fileId = sourceFileId(ownerId, projectId);
  return upsertFile(APPWRITE_SOURCE_BUCKET, fileId, file, ownerId);
}

export async function uploadProjectAsset(
  ownerId: string,
  projectId: string,
  kind: "model" | "logo" | "sound",
  file: File
) {
  const fileId = assetFileId(projectId, kind);
  return upsertFile(APPWRITE_ASSETS_BUCKET, fileId, file, ownerId);
}

export async function deleteStorageFiles(bucketId: string, fileIds: string[]) {
  const { storage } = createSessionClient();
  for (const fileId of fileIds) {
    try {
      await storage.deleteFile(bucketId, fileId);
    } catch {
      // Ignore missing files during cleanup.
    }
  }
}

export { APPWRITE_SOURCE_BUCKET, APPWRITE_ASSETS_BUCKET };
