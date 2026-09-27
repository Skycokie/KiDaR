import { describe, expect, it } from "vitest";
import { VOICE_RECORDER_ERROR_COPY, isVoiceRecordingSupported } from "./voice-recorder";

describe("voice-recorder", () => {
  it("exposes Romanian copy for recorder failures", () => {
    expect(VOICE_RECORDER_ERROR_COPY.permission).toMatch(/microfon/i);
    expect(VOICE_RECORDER_ERROR_COPY.unsupported).toMatch(/MP3|M4A/i);
  });

  it("reports recording support from browser APIs", () => {
    expect(typeof isVoiceRecordingSupported()).toBe("boolean");
  });
});
