import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { STARTING_POINT_DOORS } from "./fixtures";
import { STARTING_POINT_ART } from "./art-assets";

const publicDir = join(__dirname, "../../public");
const artSource = readFileSync(join(__dirname, "art.tsx"), "utf8");
const cssSource = readFileSync(join(__dirname, "creaza-preview.css"), "utf8");

describe("starting-point story card images", () => {
  it("maps WHO WHAT WHERE onto approved local webp stills", () => {
    expect(STARTING_POINT_DOORS).toEqual([
      { id: "character", art: "who" },
      { id: "story", art: "what" },
      { id: "world", art: "where" }
    ]);
    expect(STARTING_POINT_ART.who.src).toBe("/demo/creaza/who-story-card.webp");
    expect(STARTING_POINT_ART.what.src).toBe("/demo/creaza/what-story-card.webp");
    expect(STARTING_POINT_ART.where.src).toBe("/demo/creaza/where-story-card.webp");
  });

  it("keeps files local with stable portrait dimensions", () => {
    for (const art of Object.values(STARTING_POINT_ART)) {
      expect(art.src.startsWith("/demo/creaza/")).toBe(true);
      expect(art.src).toMatch(/\.webp$/);
      expect(art.src).not.toMatch(/^https?:/);
      expect(art.width).toBe(768);
      expect(art.height).toBe(1024);
      const diskPath = join(publicDir, art.src.replace(/^\//, ""));
      expect(existsSync(diskPath)).toBe(true);
    }
  });

  it("treats card images as decorative and sizes them in a stable frame", () => {
    expect(artSource).toMatch(/alt=""/);
    expect(artSource).toMatch(/from "next\/image"/);
    expect(artSource).toMatch(/\bfill\b/);
    expect(artSource).not.toMatch(/https?:\/\/|data:image|getUserMedia|popout_build|figurine_build|\/api\/publish/);
    expect(cssSource).toMatch(/aspect-ratio:\s*4\s*\/\s*5/);
    expect(cssSource).toMatch(/height:\s*clamp\(11\.25rem/);
    expect(cssSource).toMatch(/height:\s*clamp\(9\.375rem/);
    expect(cssSource).toMatch(/overflow-x:\s*hidden/);
    expect(cssSource).toMatch(/object-fit:\s*cover/);
  });
});
