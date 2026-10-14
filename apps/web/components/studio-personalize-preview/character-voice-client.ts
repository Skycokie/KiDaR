/**
 * Studio character voice client — GET/PATCH/DELETE voices + POST audio.
 * Same ownership path as figurine; no Tripo calls.
 */

import type { CharacterVoiceRole } from "@kidar/core";
import { PRIMARY_CHARACTER_ID } from "@kidar/core";

export function voiceApiPath(projectId: string, characterId = PRIMARY_CHARACTER_ID): string {
  return `/api/projects/${encodeURIComponent(projectId)}/voices/${encodeURIComponent(characterId)}`;
}

export function voiceAudioApiPath(projectId: string, characterId = PRIMARY_CHARACTER_ID): string {
  return `${voiceApiPath(projectId, characterId)}/audio`;
}

export type VoiceClientError =
  | "auth"
  | "not-found"
  | "invalid"
  | "voice-required"
  | "type"
  | "size"
  | "generic"
  | "network";

export type VoiceView = {
  role: CharacterVoiceRole;
  message: string;
  hasAudio: boolean;
};

export type VoiceStatusView = {
  characterId: string;
  voice: VoiceView | null;
  audioUrl: string | null;
};

export const VOICE_ERROR_KEY = {
  auth: "auth",
  "not-found": "notFound",
  invalid: "invalid",
  "voice-required": "voiceRequired",
  type: "type",
  size: "size",
  generic: "generic",
  network: "network"
} as const satisfies Record<VoiceClientError, "auth" | "notFound" | "invalid" | "voiceRequired" | "type" | "size" | "generic" | "network">;

function readJson(body: unknown): Record<string, unknown> {
  return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
}

function mapHttpError(status: number, body: unknown): VoiceClientError {
  const data = readJson(body);
  const error = typeof data.error === "string" ? data.error : "";
  if (status === 401) return "auth";
  if (status === 404) return "not-found";
  if (status === 413 || error === "too_large") return "size";
  if (status === 415 || error === "unsupported_type") return "type";
  if (error === "voice_required") return "voice-required";
  if (
    error === "invalid_character_id" ||
    error === "invalid_role" ||
    error === "message_required" ||
    error === "message_too_long" ||
    error === "missing_file"
  ) {
    return "invalid";
  }
  return "generic";
}

export function interpretVoiceStatus(body: unknown): VoiceStatusView {
  const data = readJson(body);
  const characterId =
    typeof data.characterId === "string" && data.characterId.trim()
      ? data.characterId.trim()
      : PRIMARY_CHARACTER_ID;
  const voiceRaw = data.voice && typeof data.voice === "object" ? readJson(data.voice) : null;
  const role = voiceRaw?.role;
  const message = voiceRaw?.message;
  const voice: VoiceView | null =
    (role === "narrator" || role === "hidden") && typeof message === "string" && message.trim()
      ? {
          role,
          message: message.trim(),
          hasAudio: voiceRaw?.hasAudio === true
        }
      : null;
  return {
    characterId,
    voice,
    audioUrl: typeof data.audioUrl === "string" && data.audioUrl.trim() ? data.audioUrl.trim() : null
  };
}

export async function readCharacterVoiceStatus(
  projectId: string,
  characterId = PRIMARY_CHARACTER_ID
): Promise<{ ok: true; status: VoiceStatusView } | { ok: false; error: VoiceClientError }> {
  try {
    const response = await fetch(voiceApiPath(projectId, characterId), { method: "GET" });
    const body = await response.json().catch(() => null);
    if (!response.ok) return { ok: false, error: mapHttpError(response.status, body) };
    return { ok: true, status: interpretVoiceStatus(body) };
  } catch {
    return { ok: false, error: "network" };
  }
}

export async function saveCharacterVoice(
  projectId: string,
  input: { role: CharacterVoiceRole; message: string },
  characterId = PRIMARY_CHARACTER_ID
): Promise<{ ok: true; status: VoiceStatusView } | { ok: false; error: VoiceClientError }> {
  try {
    const response = await fetch(voiceApiPath(projectId, characterId), {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input)
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) return { ok: false, error: mapHttpError(response.status, body) };
    return { ok: true, status: interpretVoiceStatus(body) };
  } catch {
    return { ok: false, error: "network" };
  }
}

export async function uploadCharacterVoiceAudioFile(
  projectId: string,
  file: File,
  characterId = PRIMARY_CHARACTER_ID
): Promise<{ ok: true; status: VoiceStatusView } | { ok: false; error: VoiceClientError }> {
  try {
    const formData = new FormData();
    formData.set("file", file);
    const response = await fetch(voiceAudioApiPath(projectId, characterId), {
      method: "POST",
      body: formData
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) return { ok: false, error: mapHttpError(response.status, body) };
    return { ok: true, status: interpretVoiceStatus(body) };
  } catch {
    return { ok: false, error: "network" };
  }
}

export async function deleteCharacterVoice(
  projectId: string,
  characterId = PRIMARY_CHARACTER_ID
): Promise<{ ok: true; status: VoiceStatusView } | { ok: false; error: VoiceClientError }> {
  try {
    const response = await fetch(voiceApiPath(projectId, characterId), { method: "DELETE" });
    const body = await response.json().catch(() => null);
    if (!response.ok) return { ok: false, error: mapHttpError(response.status, body) };
    return { ok: true, status: interpretVoiceStatus(body) };
  } catch {
    return { ok: false, error: "network" };
  }
}
