import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  applyContextStory,
  createInitialPersonalizeState,
  createDecorInstance,
  resetContextStory,
  setContextStory,
  setDecorSelection
} from "./form-state";
import {
  CONTEXT_STORY_MAX,
  CONTEXT_SUGGESTIONS,
  limitContextStory,
  parseSceneContext,
  trimContextStory
} from "./scene-context";

describe("local Studio Context step", () => {
  it("fills the story field from a suggestion without applying Studio choices", () => {
    const tree = createDecorInstance("tree");
    const start = {
      ...createInitialPersonalizeState(),
      animation: "dance" as const,
      decor: [tree],
      palette: "soft" as const
    };
    const filled = setContextStory(start, CONTEXT_SUGGESTIONS[0]);
    expect(filled.contextStory).toBe("Într-o grădină magică");
    expect(filled.animation).toBe("dance");
    expect(filled.decor).toEqual([tree]);
    expect(filled.palette).toBe("soft");
    expect(filled.context.story).toBe("");
    const card = readFileSync(join(__dirname, "context-card.tsx"), "utf8");
    const chipsBlock = card.slice(
      card.indexOf("studio-context__chips"),
      card.indexOf("studio-context__actions")
    );
    expect(chipsBlock).toContain("onClick={() => onChange(suggestion)}");
    expect(chipsBlock).not.toContain("onApply");
  });

  it("applies a recognized Romanian story onto local preview state", () => {
    const next = applyContextStory(
      createInitialPersonalizeState(),
      "Personajul meu plutește printre stele, salută și spune «Bună!»."
    );
    expect(next.animation).toBe("wave");
    expect(next.decor.map((item) => item.id)).toEqual(["stars"]);
    expect(next.context.story).toContain("plutește printre stele");
    expect(next.context.location).toBe("printre stele");
    expect(next.context.action).toBe("salută");
    expect(next.context.dialogue).toBe("Bună!");
    expect(next.context.previewOnly).toBe(true);
    expect(next.contextNotice).toBeNull();

    const garden = applyContextStory(createInitialPersonalizeState(), "Într-o grădină magică");
    expect(garden.decor.map((item) => item.id)).toEqual(["grass"]);
    expect(garden.context.location).toBe("într-o grădină");
    expect(garden.context.mood).toBe("magică");

    const stars = applyContextStory(createInitialPersonalizeState(), "Printre stele");
    expect(stars.decor.map((item) => item.id)).toEqual(["stars"]);

    const forest = applyContextStory(createInitialPersonalizeState(), "Într-o pădure liniștită");
    expect(forest.decor.map((item) => item.id)).toEqual(["tree"]);
    expect(forest.context.mood).toBe("liniștită");

    const house = applyContextStory(createInitialPersonalizeState(), "La o casă colorată");
    expect(house.decor.map((item) => item.id)).toEqual(["house"]);
    expect(house.palette).toBe("bright");

    const balloons = applyContextStory(createInitialPersonalizeState(), "Într-o lume cu baloane");
    expect(balloons.decor.map((item) => item.id)).toEqual(["balloons"]);
  });

  it("preserves existing Studio choices when the story is not recognized", () => {
    const tree = createDecorInstance("tree");
    const start = {
      ...createInitialPersonalizeState(),
      animation: "dance" as const,
      decor: [tree],
      palette: "bright" as const,
      lighting: "studio" as const
    };
    const next = applyContextStory(start, "ceva ce nu recunosc deloc");
    expect(next.animation).toBe("dance");
    expect(next.decor).toEqual([tree]);
    expect(next.palette).toBe("bright");
    expect(next.lighting).toBe("studio");
    expect(next.context.story).toBe("ceva ce nu recunosc deloc");
    expect(next.contextNotice).toContain("Am păstrat setările existente");
  });

  it("reset clears only context story and summary fields", () => {
    let state = setDecorSelection(createInitialPersonalizeState(), "stars");
    state = { ...state, animation: "float" as const, palette: "bright" as const };
    state = applyContextStory(state, "Printre stele");
    expect(state.context.story).toBe("Printre stele");
    const cleared = resetContextStory(state);
    expect(cleared.contextStory).toBe("");
    expect(cleared.context.story).toBe("");
    expect(cleared.context.location).toBe("");
    expect(cleared.context.action).toBe("");
    expect(cleared.context.mood).toBe("");
    expect(cleared.context.dialogue).toBe("");
    expect(cleared.animation).toBe("float");
    expect(cleared.decor.map((item) => item.id)).toEqual(["stars"]);
    expect(cleared.palette).toBe("bright");
  });

  it("asks for a story before applying empty text", () => {
    const start = { ...createInitialPersonalizeState(), animation: "still" as const };
    const empty = applyContextStory(start, "   ");
    expect(empty.animation).toBe("still");
    expect(empty.contextNotice).toContain("Scrie întâi");
  });

  it("trims and slices story to 500 characters and stores HTML as plain text", () => {
    const long = `${"plutește ".repeat(80)}printre stele`;
    expect(limitContextStory(long).length).toBe(CONTEXT_STORY_MAX);
    expect(trimContextStory("  hello   world  ")).toBe("hello world");
    const withMarkup = applyContextStory(
      createInitialPersonalizeState(),
      'Personajul <b>sare</b> lângă o casă și spune «Bună!»'
    );
    expect(withMarkup.context.story).toContain("<b>sare</b>");
    expect(withMarkup.context.dialogue).toBe("Bună!");
    expect(withMarkup.animation).toBe("jump");
    expect(withMarkup.decor.map((item) => item.id)).toEqual(["house"]);
    const parsed = parseSceneContext(withMarkup.context.story);
    expect(parsed.context.story).not.toMatch(/dangerouslySetInnerHTML/);
  });

  it("shows the story on the local scene as plain text", () => {
    const shell = readFileSync(join(__dirname, "personalize-shell.tsx"), "utf8");
    const stage = readFileSync(join(__dirname, "garden-poster.tsx"), "utf8");
    expect(shell).toContain("contextPreviewLines(scene.context, state)");
    expect(stage).toContain("{state.context.dialogue}");
    expect(`${shell}\n${stage}`).not.toMatch(/dangerouslySetInnerHTML/);
  });

  it("does not call network or media APIs from context modules", () => {
    const sources = ["scene-context.ts", "context-card.tsx", "garden-poster.tsx"]
      .map((file) => readFileSync(join(__dirname, file), "utf8"))
      .join("\n");
    expect(sources).not.toMatch(/\bfetch\s*\(/);
    expect(sources).not.toMatch(/XMLHttpRequest|WebSocket/);
    expect(sources).not.toMatch(/\bgetUserMedia\b|mediaDevices/);
    expect(sources).not.toMatch(/tripo|openai|anthropic/i);
    expect(sources).not.toMatch(/dangerouslySetInnerHTML/);
  });
});
