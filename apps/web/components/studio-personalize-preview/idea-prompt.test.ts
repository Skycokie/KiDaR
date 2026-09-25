import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  applyIdeaPrompt,
  createInitialPersonalizeState,
  createWorkspaceState,
  resetIdeaPrompt
} from "./form-state";
import { IDEA_SUGGESTIONS, interpretIdeaPrompt } from "./idea-prompt";

describe("local Studio idea prompt", () => {
  it("maps a Romanian idea onto motion, decor, and palette together", () => {
    const result = interpretIdeaPrompt("Să sară lângă o casă colorată");
    expect(result.recognized).toBe(true);
    expect(result.motion).toBe("jump");
    expect(result.decor).toBe("house");
    expect(result.palette).toBe("bright");
    expect(result.lines).toEqual(["Mișcare: Sare", "Decor: Casă", "Culori: Vii"]);
  });

  it("accepts the suggestion phrases, with and without diacritics", () => {
    expect(interpretIdeaPrompt(IDEA_SUGGESTIONS[0])).toMatchObject({ motion: "float", decor: "stars" });
    expect(interpretIdeaPrompt("Sa pluteasca printre stele")).toMatchObject({
      motion: "float",
      decor: "stars"
    });
    expect(interpretIdeaPrompt(IDEA_SUGGESTIONS[1])).toMatchObject({ motion: "dance", decor: "grass" });
    expect(interpretIdeaPrompt(IDEA_SUGGESTIONS[2])).toMatchObject({
      motion: "jump",
      decor: "house",
      palette: "bright"
    });
    expect(interpretIdeaPrompt(IDEA_SUGGESTIONS[3])).toMatchObject({ motion: "still", decor: "cloud" });
    expect(interpretIdeaPrompt(IDEA_SUGGESTIONS[4])).toMatchObject({ decor: "balloons" });
    expect(interpretIdeaPrompt("vreau sa zboara in aer, lumina de studio")).toMatchObject({
      motion: "float",
      lighting: "studio"
    });
  });

  it("keeps the last match in a category and ignores lookalike fragments", () => {
    expect(interpretIdeaPrompt("sare, apoi plutește")).toMatchObject({ motion: "float" });
    expect(interpretIdeaPrompt("un pastel sta bine")).toMatchObject({
      motion: "still",
      palette: "soft"
    });
    const missed = interpretIdeaPrompt("pastel");
    expect(missed.motion).toBeUndefined();
    expect(missed.palette).toBe("soft");
  });

  it("does not reset existing Studio choices when nothing is recognized", () => {
    const start = {
      ...createInitialPersonalizeState(),
      animation: "dance" as const,
      decor: ["tree" as const],
      palette: "bright" as const,
      lighting: "studio" as const
    };
    const next = applyIdeaPrompt(start, "ceva ce nu recunosc deloc");
    expect(next.animation).toBe("dance");
    expect(next.decor).toEqual(["tree"]);
    expect(next.palette).toBe("bright");
    expect(next.lighting).toBe("studio");
    expect(next.ideaResult?.recognized).toBe(false);
  });

  it("asks for an idea before applying an empty prompt and reset clears only the idea", () => {
    const start = { ...createInitialPersonalizeState(), animation: "still" as const, ideaPrompt: "salută" };
    const empty = applyIdeaPrompt(start, "   ");
    expect(empty.animation).toBe("still");
    expect(empty.ideaNotice).toContain("Scrie întâi");
    const applied = applyIdeaPrompt(start, "salută");
    expect(applied.animation).toBe("wave");
    const cleared = resetIdeaPrompt(applied);
    expect(cleared.ideaPrompt).toBe("");
    expect(cleared.ideaResult).toBeNull();
    expect(cleared.animation).toBe("wave");
  });

  it("keeps creative steps locked until a source drawing exists", () => {
    const empty = createWorkspaceState({ hasDrawing: false, yaw: null, pitch: null });
    expect(empty.stage).toBe("desenul");
    expect(empty.completedStages).toEqual([]);
    const ready = createWorkspaceState({ hasDrawing: true, yaw: 12, pitch: 4 });
    expect(ready.stage).toBe("personajul");
    expect(ready.completedStages).toContain("desenul");
    expect(ready.orbitYaw).toBe(12);
    expect(ready.orbitPitch).toBe(4);
  });

  it("limits length and does not call the network", () => {
    const long = interpretIdeaPrompt(`${"plutește ".repeat(80)}stele`);
    expect(long.text.length).toBeLessThanOrEqual(240);
    const sources = ["idea-prompt.ts", "idea-prompt-card.tsx"]
      .map((file) => readFileSync(join(__dirname, file), "utf8"))
      .join("\n");
    expect(sources).not.toMatch(/\bfetch\s*\(/);
    expect(sources).not.toMatch(/XMLHttpRequest|WebSocket|tripo|openai|anthropic/i);
  });
});
