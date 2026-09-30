import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { STUDIO_HERO_FILM } from "./hero-phone";

const publicDir = join(__dirname, "../../public");
const artworksSource = readFileSync(join(__dirname, "artworks.tsx"), "utf8");
const cssSource = readFileSync(join(__dirname, "studio-preview.css"), "utf8");

describe("Studio atelier hero film", () => {
  it("ships one local chase film with a poster", () => {
    expect(STUDIO_HERO_FILM.src).toBe("/demo/studio/rooster-chase.mp4");
    expect(STUDIO_HERO_FILM.poster).toBe("/demo/studio/rooster-chase-poster.webp");
    expect(existsSync(join(publicDir, "demo/studio/rooster-chase.mp4"))).toBe(true);
    expect(existsSync(join(publicDir, "demo/studio/rooster-chase-poster.webp"))).toBe(true);
  });

  it("shows the film as a 16:9 stage, not a phone frame", () => {
    expect(artworksSource).toMatch(/HeroStageFilm/);
    expect(cssSource).toMatch(/\.atelier-film/);
    expect(cssSource).toMatch(/aspect-ratio:\s*16\s*\/\s*9/);
    expect(cssSource).not.toMatch(/\.atelier-phone/);
  });
});
