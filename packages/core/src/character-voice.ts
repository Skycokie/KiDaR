/**
 * Studio character voice — narrator / hidden role + short message + optional audio.
 * Persisted on ProjectSettings.characterVoices; never part of pipeline inputHash.
 */

export const CHARACTER_VOICE_ROLES = ["narrator", "hidden"] as const;
export type CharacterVoiceRole = (typeof CHARACTER_VOICE_ROLES)[number];

export const CHARACTER_VOICE_MESSAGE_MAX = 160;
export const CHARACTER_VOICE_AUDIO_MAX_BYTES = 2 * 1024 * 1024;
export const CHARACTER_VOICE_AUDIO_MAX_SECONDS = 30;

export const CHARACTER_VOICE_AUDIO_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/x-m4a",
  "audio/m4a",
  "audio/webm",
  "audio/ogg",
  "audio/ogg; codecs=opus"
]);

/** Stable subject id used by figurine + voice (MVP: one character). */
export const PRIMARY_CHARACTER_ID = "primary";

export type CharacterVoice = {
  role: CharacterVoiceRole;
  message: string;
  /** Private Appwrite assets-bucket file id; signed URL is minted at read time. */
  audioPath?: string;
};

export type CharacterVoiceMap = Record<string, CharacterVoice>;

export type NormalizeCharacterVoiceOk = {
  ok: true;
  characterId: string;
  voice: CharacterVoice;
};

export type NormalizeCharacterVoiceFail = {
  ok: false;
  code:
    | "invalid_character_id"
    | "invalid_role"
    | "message_required"
    | "message_too_long";
  message: string;
};

const CHARACTER_ID_RE = /^[a-zA-Z][a-zA-Z0-9_-]{0,31}$/;

export function isCharacterVoiceRole(value: unknown): value is CharacterVoiceRole {
  return (
    typeof value === "string" &&
    (CHARACTER_VOICE_ROLES as readonly string[]).includes(value)
  );
}

export function isValidCharacterId(value: unknown): value is string {
  return typeof value === "string" && CHARACTER_ID_RE.test(value);
}

export function trimVoiceMessage(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

/**
 * Validates and normalizes a voice patch. Keeps existing audioPath unless cleared.
 */
export function normalizeCharacterVoice(input: {
  characterId: unknown;
  role: unknown;
  message: unknown;
  audioPath?: string | null;
}): NormalizeCharacterVoiceOk | NormalizeCharacterVoiceFail {
  if (!isValidCharacterId(input.characterId)) {
    return {
      ok: false,
      code: "invalid_character_id",
      message: "Identificatorul personajului nu este valid."
    };
  }
  if (!isCharacterVoiceRole(input.role)) {
    return {
      ok: false,
      code: "invalid_role",
      message: "Alege Narator sau Ascuns."
    };
  }
  if (typeof input.message !== "string") {
    return {
      ok: false,
      code: "message_required",
      message: "Scrie un mesaj scurt pentru personaj."
    };
  }
  const message = trimVoiceMessage(input.message);
  if (!message) {
    return {
      ok: false,
      code: "message_required",
      message: "Scrie un mesaj scurt pentru personaj."
    };
  }
  if (message.length > CHARACTER_VOICE_MESSAGE_MAX) {
    return {
      ok: false,
      code: "message_too_long",
      message: `Mesajul poate avea cel mult ${CHARACTER_VOICE_MESSAGE_MAX} de caractere.`
    };
  }

  const voice: CharacterVoice = {
    role: input.role,
    message
  };
  if (typeof input.audioPath === "string" && input.audioPath.trim()) {
    voice.audioPath = input.audioPath.trim();
  }

  return {
    ok: true,
    characterId: input.characterId,
    voice
  };
}

export function isAllowedVoiceAudioType(mime: string): boolean {
  const base = mime.split(";")[0]?.trim().toLowerCase() ?? "";
  if (CHARACTER_VOICE_AUDIO_TYPES.has(mime.toLowerCase())) return true;
  return CHARACTER_VOICE_AUDIO_TYPES.has(base);
}

export function readCharacterVoice(
  map: CharacterVoiceMap | undefined,
  characterId: string
): CharacterVoice | null {
  if (!map || !isValidCharacterId(characterId)) return null;
  const voice = map[characterId];
  if (!voice || !isCharacterVoiceRole(voice.role)) return null;
  const message = typeof voice.message === "string" ? trimVoiceMessage(voice.message) : "";
  if (!message) return null;
  return {
    role: voice.role,
    message: message.slice(0, CHARACTER_VOICE_MESSAGE_MAX),
    audioPath:
      typeof voice.audioPath === "string" && voice.audioPath.trim()
        ? voice.audioPath.trim()
        : undefined
  };
}

export function upsertCharacterVoice(
  map: CharacterVoiceMap | undefined,
  characterId: string,
  voice: CharacterVoice
): CharacterVoiceMap {
  return {
    ...(map ?? {}),
    [characterId]: voice
  };
}

export function removeCharacterVoice(
  map: CharacterVoiceMap | undefined,
  characterId: string
): CharacterVoiceMap {
  if (!map) return {};
  const next = { ...map };
  delete next[characterId];
  return next;
}
