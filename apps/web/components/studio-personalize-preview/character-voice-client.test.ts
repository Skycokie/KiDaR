import { describe, expect, it } from "vitest";
import { getMessages } from "@/i18n/get-messages";
import { interpretVoiceStatus, voiceApiPath, voiceAudioApiPath } from "./character-voice-client";

describe("character-voice-client", () => {
  it("builds owned voice routes", () => {
    expect(voiceApiPath("abc 1")).toBe("/api/projects/abc%201/voices/primary");
    expect(voiceAudioApiPath("abc 1", "hero")).toBe("/api/projects/abc%201/voices/hero/audio");
  });

  it("reads voice status payloads", () => {
    const status = interpretVoiceStatus({
      characterId: "primary",
      voice: { role: "narrator", message: "Salut!", hasAudio: true },
      audioUrl: "https://example.test/a.mp3"
    });
    expect(status.voice?.role).toBe("narrator");
    expect(status.audioUrl).toContain("a.mp3");
    expect(interpretVoiceStatus({ characterId: "primary", voice: null, audioUrl: null }).voice).toBeNull();
  });

  it("exposes Romanian error copy", () => {
    const ro = getMessages("ro").personalize.voiceErrors;
    const en = getMessages("en").personalize.voiceErrors;
    expect(ro.voiceRequired).toMatch(/mesajul/);
    expect(ro.size).toMatch(/2 MB/);
    expect(en.voiceRequired).not.toMatch(/mesajul/);
    expect(en.size).toMatch(/2 MB/);
  });
});
