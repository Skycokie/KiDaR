import { describe, expect, it } from "vitest";
import { getMessages } from "@/i18n/get-messages";
import { isVoiceRecordingSupported } from "./voice-recorder";

describe("voice-recorder", () => {
  it("exposes Romanian copy for recorder failures", () => {
    const ro = getMessages("ro").personalize.recorderErrors;
    const en = getMessages("en").personalize.recorderErrors;
    expect(ro.permission).toMatch(/microfon/i);
    expect(ro.unsupported).toMatch(/MP3|M4A/i);
    expect(en.permission).not.toMatch(/microfon/i);
    expect(en.unsupported).toMatch(/MP3|M4A/i);
  });

  it("reports recording support from browser APIs", () => {
    expect(typeof isVoiceRecordingSupported()).toBe("boolean");
  });
});
