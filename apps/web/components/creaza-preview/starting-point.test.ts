import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getMessages } from "@/i18n/get-messages";
import { STARTING_POINT_ART } from "./art-assets";
import { STARTING_POINT_DOORS } from "./fixtures";
import {
  beginPresetCreate,
  createInitialCreazaFormState,
  decidePresetCta,
  selectStartingPoint
} from "./form-state";
import {
  CREATIVE_STARTING_POINTS,
  TECHNICAL_CREATE_PRESET,
  creazaPersonalizeHref,
  creativeIdeaPrompt,
  isCreativeStartingPoint,
  parseCreativeStartingPoint,
  parseCreativeSuggestionIndex
} from "./starting-point";

const startingPointSource = readFileSync(join(__dirname, "starting-point.ts"), "utf8");
const shellSource = readFileSync(join(__dirname, "creaza-shell.tsx"), "utf8");

describe("creative starting points", () => {
  it("matches the specified Romanian and English card copy", () => {
    const ro = getMessages("ro").creaza.preset;
    const en = getMessages("en").creaza.preset;
    expect(ro.title).toBe("În ce se va transforma povestea ta?");
    expect(en.title).toBe("What will your story become?");
    expect(ro.lead).toBe("Începe cu un desen. Dă-i o lume.");
    expect(en.lead).toBe("Start with a drawing. Give it a world.");
    expect(ro.chooseCta).toBe("Alege această idee");
    expect(en.chooseCta).toBe("Choose this idea");
    expect(ro.doors.character.eyebrow).toBe("CINE?");
    expect(en.doors.character.eyebrow).toBe("WHO?");
    expect(ro.doors.story.eyebrow).toBe("CE?");
    expect(en.doors.story.eyebrow).toBe("WHAT?");
    expect(ro.doors.world.eyebrow).toBe("UNDE?");
    expect(en.doors.world.eyebrow).toBe("WHERE?");
  });

  it("accepts character, story, and world", () => {
    expect(CREATIVE_STARTING_POINTS).toEqual(["character", "story", "world"]);
    for (const kind of CREATIVE_STARTING_POINTS) {
      expect(isCreativeStartingPoint(kind)).toBe(true);
    }
    expect(isCreativeStartingPoint("coloring")).toBe(false);
    expect(isCreativeStartingPoint("mission")).toBe(false);
  });

  it.each(CREATIVE_STARTING_POINTS)("stores %s locally and uses the shared coloring preset", (kind) => {
    const next = selectStartingPoint(createInitialCreazaFormState(), kind);
    expect(next.startingPoint).toBe(kind);
    expect(next.preset).toBe(TECHNICAL_CREATE_PRESET);
    expect(next.preset).toBe("coloring");
    expect(next.suggestionIndex).toBeNull();
    expect(decidePresetCta(next)).toEqual({ kind: "create", preset: "coloring" });
  });

  it("updates the suggestion index without changing the technical preset", () => {
    let state = selectStartingPoint(createInitialCreazaFormState(), "story", 1);
    expect(state.startingPoint).toBe("story");
    expect(state.suggestionIndex).toBe(1);
    expect(state.preset).toBe("coloring");
    state = selectStartingPoint(state, "story", 2);
    expect(state.suggestionIndex).toBe(2);
    state = selectStartingPoint(state, "world");
    expect(state.startingPoint).toBe("world");
    expect(state.suggestionIndex).toBeNull();
    expect(state.preset).toBe("coloring");
  });

  it("keeps all three options on the same create path", () => {
    for (const kind of CREATIVE_STARTING_POINTS) {
      let state = selectStartingPoint(createInitialCreazaFormState(), kind);
      state = beginPresetCreate(state);
      expect(state.presetBusy).toBe(true);
      expect(state.step).toBe("preset");
      expect(decidePresetCta(state).kind).toBe("create");
    }
  });

  it("builds Romanian and English idea seeds, including a selected chip", () => {
    const ro = getMessages("ro").creaza.preset;
    const en = getMessages("en").creaza.preset;
    expect(creativeIdeaPrompt(ro, "character")).toBe("Dă viață personajului din acest desen.");
    expect(creativeIdeaPrompt(en, "character")).toBe("Bring the character in this drawing to life.");
    expect(creativeIdeaPrompt(ro, "story", 0)).toBe(
      "Transformă acest desen într-o poveste. Ce se întâmplă mai departe? Găsește cocoșul dispărut"
    );
    expect(creativeIdeaPrompt(en, "world", 2)).toBe(
      "Build a world around this drawing. Where does the story begin? A detective room"
    );
  });

  it("hands off from= and hint= on the Personalize URL without dropping projectId", () => {
    expect(creazaPersonalizeHref("proj_1", "ro", "character", 0)).toBe(
      "/studio-preview/personalizeaza?projectId=proj_1&from=character&hint=0"
    );
    expect(creazaPersonalizeHref("proj_1", "en", "world", null)).toBe(
      "/en/studio-preview/personalizeaza?projectId=proj_1&from=world"
    );
    expect(parseCreativeStartingPoint("story")).toBe("story");
    expect(parseCreativeStartingPoint("coloring")).toBeNull();
    expect(parseCreativeSuggestionIndex("2")).toBe(2);
    expect(parseCreativeSuggestionIndex("9")).toBeNull();
  });

  it("keeps WHO WHAT WHERE image refs on the shared selectable cards", () => {
    expect(STARTING_POINT_DOORS.map((door) => door.id)).toEqual([...CREATIVE_STARTING_POINTS]);
    expect(STARTING_POINT_ART.who.src).toContain("who-story-card.webp");
    expect(STARTING_POINT_ART.what.src).toContain("what-story-card.webp");
    expect(STARTING_POINT_ART.where.src).toContain("where-story-card.webp");
    expect(shellSource).toMatch(/data-art=\{door\.art\}/);
    expect(shellSource).toMatch(/aria-pressed=\{chipSelected\}/);
    expect(shellSource).toMatch(/aria-pressed=\{selected\}/);
  });

  it("does not fetch, generate, open AR, or publish on card selection", () => {
    expect(selectStartingPoint.toString()).not.toMatch(/\bfetch\b/);
    expect(startingPointSource).not.toMatch(/\bfetch\b|\/api\/publish|popout_build|figurine_build|getUserMedia/);
    expect(shellSource).toMatch(/select-starting-point/);
    expect(shellSource).toMatch(/capture="environment"/);
    expect(shellSource).not.toMatch(/getUserMedia|popout_build|figurine_build/);
    const css = readFileSync(join(__dirname, "creaza-preview.css"), "utf8");
    expect(css).toMatch(/prefers-reduced-motion:\s*reduce/);
    expect(css).toMatch(/\.creaza-door:hover \{\s*transform: none;/);
  });
});
