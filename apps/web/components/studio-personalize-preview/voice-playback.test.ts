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

  it("does not re-arm the narrator on stage change", () => {
    const shell = read("personalize-shell.tsx");
    const stageEffect = shell.slice(shell.indexOf("// Narrator replays only after"), shell.indexOf("}, [state.stage]);"));
    expect(stageEffect).toContain("stopVoiceAudio();");
    expect(stageEffect).not.toContain("narratorPlayedRef.current = false");
  });
});
