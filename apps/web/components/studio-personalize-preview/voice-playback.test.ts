import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(join(__dirname, file), "utf8");

describe("Studio voice playback", () => {
  it("uses one Audio instance owned by the shell", () => {
    expect(read("voice-card.tsx")).not.toMatch(/new Audio\(/);
    const shell = read("personalize-shell.tsx");
    expect(shell.match(/new Audio\(/g)).toHaveLength(1);
    expect(shell).toContain("onPlayVoice={playVoiceClip}");
  });

  it("previews the card's unsaved role and message on stage", () => {
    const shell = read("personalize-shell.tsx");
    expect(shell).toContain("onVoiceDraftChange={setVoiceDraft}");
    expect(shell).toContain("const voice = liveVoice;");
    expect(shell).toContain('speakCharacter("tap")');
    expect(shell).not.toMatch(/voiceStatus\?\.voice\?\.role/);
  });

  it("tapping a speaking character stops it", () => {
    const shell = read("personalize-shell.tsx");
    const tap = shell.slice(shell.indexOf("const onCharacterClick"), shell.indexOf("const onViewportPointerDown"));
    expect(tap).toContain("if (spokenMessage !== null)");
    expect(tap).toContain("silenceCharacter();");
  });

  it("saves the current role and message before uploading audio", () => {
    const card = read("voice-card.tsx");
    expect(card).toContain("status.voice.role !== role || status.voice.message !== message.trim()");
  });

  it("does not re-arm the narrator on stage change", () => {
    const shell = read("personalize-shell.tsx");
    const stageEffect = shell.slice(shell.indexOf("// Narrator replays only after"), shell.indexOf("}, [state.stage]);"));
    expect(stageEffect).toContain("stopVoiceAudio();");
    expect(stageEffect).not.toContain("narratorPlayedRef.current = false");
  });
});
