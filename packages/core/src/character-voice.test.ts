import { describe, expect, it } from "vitest";
import {
  CHARACTER_VOICE_MESSAGE_MAX,
  PRIMARY_CHARACTER_ID,
  isAllowedVoiceAudioType,
  isValidCharacterId,
  normalizeCharacterVoice,
  readCharacterVoice,
  removeCharacterVoice,
  upsertCharacterVoice
} from "./character-voice";

describe("character-voice", () => {
  it("accepts primary and simple ids", () => {
    expect(isValidCharacterId(PRIMARY_CHARACTER_ID)).toBe(true);
    expect(isValidCharacterId("hero-1")).toBe(true);
    expect(isValidCharacterId("")).toBe(false);
    expect(isValidCharacterId("1bad")).toBe(false);
    expect(isValidCharacterId("has space")).toBe(false);
  });

  it("normalizes role and trims message", () => {
    const result = normalizeCharacterVoice({
      characterId: "primary",
      role: "narrator",
      message: "  Bună   lume!  ",
      audioPath: "voice_primary_abc"
    });
    expect(result).toEqual({
      ok: true,
      characterId: "primary",
      voice: {
        role: "narrator",
        message: "Bună lume!",
        audioPath: "voice_primary_abc"
      }
    });
  });

  it("rejects bad role, empty message, and overlong message", () => {
    expect(
      normalizeCharacterVoice({ characterId: "primary", role: "host", message: "hi" }).ok
    ).toBe(false);
    expect(
      normalizeCharacterVoice({ characterId: "primary", role: "hidden", message: "   " }).ok
    ).toBe(false);
    expect(
      normalizeCharacterVoice({
        characterId: "primary",
        role: "hidden",
        message: "x".repeat(CHARACTER_VOICE_MESSAGE_MAX + 1)
      }).ok
    ).toBe(false);
  });

  it("allows common voice audio mime types", () => {
    expect(isAllowedVoiceAudioType("audio/mpeg")).toBe(true);
    expect(isAllowedVoiceAudioType("audio/webm")).toBe(true);
    expect(isAllowedVoiceAudioType("audio/ogg; codecs=opus")).toBe(true);
    expect(isAllowedVoiceAudioType("video/mp4")).toBe(false);
  });

  it("upserts and removes voices without mutating other keys", () => {
    const first = upsertCharacterVoice(undefined, "primary", {
      role: "narrator",
      message: "Salut"
    });
    const second = upsertCharacterVoice(first, "sidekick", {
      role: "hidden",
      message: "Psst"
    });
    expect(Object.keys(second).sort()).toEqual(["primary", "sidekick"]);
    const removed = removeCharacterVoice(second, "primary");
    expect(removed).toEqual({
      sidekick: { role: "hidden", message: "Psst" }
    });
    expect(readCharacterVoice(removed, "sidekick")?.message).toBe("Psst");
    expect(readCharacterVoice(removed, "primary")).toBeNull();
  });
});
