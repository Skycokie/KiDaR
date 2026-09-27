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

  it.each(["app/auth/callback/route.ts", "components/landing/drawing-scene.tsx"])(
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
