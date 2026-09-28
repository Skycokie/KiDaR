import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { en } from "./messages/en";
import { ro } from "./messages/ro";

const ROMANIAN_CHARS = /[ăâîșşțţ]/i;

function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}

const read = (path: string) => readFileSync(join(__dirname, "..", path), "utf8");

describe("i18n coverage", () => {
  it("has no Romanian text in English messages", () => {
    const leaks = strings(en).filter((text) => ROMANIAN_CHARS.test(text));
    expect(leaks).toEqual([]);
  });

  it("translates every Romanian message", () => {
    const roTexts = strings(ro);
    const enTexts = strings(en);
    expect(enTexts).toHaveLength(roTexts.length);
    const untranslated = roTexts.filter((text, index) => ROMANIAN_CHARS.test(text) && text === enTexts[index]);
    expect(untranslated).toEqual([]);
  });

  it("uses one brand spelling", () => {
    expect([...strings(ro), ...strings(en)].filter((text) => text.includes("kiDAR"))).toEqual([]);
  });

  it.each([
    "app/auth/callback/route.ts",
    "components/landing/drawing-scene.tsx",
    "app/studio/page.tsx",
    "components/studio-preview/studio-shell.tsx",
    "components/studio-preview/fixtures.ts",
    "components/studio-preview/artworks.tsx",
    "lib/studio-worlds.ts",
    "app/creaza/page.tsx",
    "components/creaza-preview/creaza-shell.tsx",
    "components/creaza-preview/fixtures.ts",
    "components/creaza-preview/form-state.ts",
    "components/creaza-preview/create-project.ts",
    "components/creaza-preview/starting-point.ts",
    "app/studio-preview/personalizeaza/page.tsx",
    "components/studio-personalize-preview/personalize-shell.tsx",
    "components/studio-personalize-preview/fixtures.ts",
    "components/studio-personalize-preview/idea-prompt-card.tsx",
    "components/studio-personalize-preview/context-card.tsx",
    "components/studio-personalize-preview/voice-card.tsx",
    "components/studio-personalize-preview/figurine-generate-card.tsx",
    "components/studio-personalize-preview/garden-poster.tsx",
    "components/studio-personalize-preview/form-state.ts",
    "components/studio-personalize-preview/generate-figurine.ts",
    "components/studio-personalize-preview/character-voice-client.ts",
    "components/studio-personalize-preview/voice-recorder.ts",
    "components/studio-personalize-preview/save-start-transform.ts",
    "components/studio-personalize-preview/scene-context.ts",
    "components/studio-personalize-preview/popout-mesh-stage.tsx",
    "components/studio-personalize-preview/figurine-live-stage.tsx",
    "app/studio-preview/personalizeaza/camera/page.tsx",
    "components/studio-personalize-preview/camera-ar-shell.tsx",
    "components/studio-personalize-preview/camera-ar-scene.tsx",
    "components/studio-personalize-preview/camera-ar-state.ts",
    "components/studio-personalize-preview/camera-ar-fixtures.ts",
    "app/ar/[slug]/route.ts"
  ])(
    "%s has no hardcoded Romanian UI text",
    (file) => {
      const source = read(file)
        .split(/\r?\n/)
        .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
        .join("\n");
      expect(source).not.toMatch(ROMANIAN_CHARS);
    }
  );
});
