import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  artKindFromId,
  editorialPosterSrc,
  fixtureStudioWorlds,
  formatStudioUpdatedLabel,
  normalizeStudioWorldStatus,
  toStudioWorldCard,
  visualVariantFromId
} from "./studio-worlds";

describe("studio-worlds DTO mapping", () => {
  it("normalizes status into locale-neutral codes", () => {
    expect(normalizeStudioWorldStatus("draft")).toBe("draft");
    expect(normalizeStudioWorldStatus("processing")).toBe("draft");
    expect(normalizeStudioWorldStatus("error")).toBe("draft");
    expect(normalizeStudioWorldStatus("ready")).toBe("ready");
    expect(normalizeStudioWorldStatus("published")).toBe("published");
    expect(
      normalizeStudioWorldStatus("ready", { publicExperienceUrl: "https://example.com/ar/x" })
    ).toBe("published");
  });

  it("maps ProjectRecord-like input to a reduced card without storage paths", () => {
    const card = toStudioWorldCard({
      id: "abc123",
      name: "Dragonul meu",
      status: "draft",
      updated_at: "2026-09-18T10:00:00.000Z",
      settings: {
        title: "  Aurora vie  ",
        theme: "#000",
        scale: 1,
        offset: { x: 0, y: 0, z: 0 },
        // sensitive-ish fields must not appear on the card
        uploadModelPath: "secret-file-id",
        publicHtmlUrl: undefined
      }
    });

    expect(card).toEqual({
      id: "abc123",
      title: "Aurora vie",
      href: "/studio-preview/personalizeaza?projectId=abc123",
      status: "draft",
      updatedLabel: expect.any(String),
      visualVariant: visualVariantFromId("abc123"),
      preview: {
        kind: "safe-preview",
        src: editorialPosterSrc(visualVariantFromId("abc123")),
        alt: "Aurora vie"
      }
    });
    expect(card).not.toHaveProperty("uploadModelPath");
    expect(card).not.toHaveProperty("source_image_path");
    expect(card.preview?.src).toMatch(/^\/demo\/studio\/worlds\//);
  });

  it("opens worlds in the personalize workspace, keeping the locale", () => {
    const base = { id: "a b", name: "x", status: "draft", updated_at: "2026-09-18T10:00:00.000Z" };
    expect(toStudioWorldCard(base, "ro").href).toBe("/studio-preview/personalizeaza?projectId=a%20b");
    expect(toStudioWorldCard(base, "en").href).toBe("/en/studio-preview/personalizeaza?projectId=a%20b");
    expect(toStudioWorldCard(base, "en").href).not.toMatch(/^\/(en\/)?studio\/[^/]/);
  });

  it("names untitled worlds in the requested locale", () => {
    const base = { id: "x", name: " ", status: "draft", updated_at: "2026-09-18T10:00:00.000Z" };
    expect(toStudioWorldCard(base, "ro").title).toBe("Lume fără nume");
    expect(toStudioWorldCard(base, "en").title).toBe("Untitled world");
  });

  it("derives stable editorial variants from id", () => {
    expect(visualVariantFromId("proj-a")).toBe(visualVariantFromId("proj-a"));
    expect(["portrait", "landscape", "square"]).toContain(visualVariantFromId("proj-a"));
    expect(["aurora", "garden", "kite"]).toContain(artKindFromId("proj-a"));
  });

  it("formats updated labels per locale without technical ids", () => {
    const now = new Date("2026-09-20T12:00:00.000Z");
    expect(formatStudioUpdatedLabel("2026-09-20T08:00:00.000Z", "ro", now)).toBe("actualizat azi");
    expect(formatStudioUpdatedLabel("2026-09-19T08:00:00.000Z", "ro", now)).toBe("actualizat ieri");
    expect(formatStudioUpdatedLabel("2026-09-01T08:00:00.000Z", "ro", now)).toMatch(/^actualizat \d/);
    expect(formatStudioUpdatedLabel("2026-09-20T08:00:00.000Z", "en", now)).toBe("updated today");
    expect(formatStudioUpdatedLabel("2026-09-19T08:00:00.000Z", "en", now)).toBe("updated yesterday");
    expect(formatStudioUpdatedLabel("2026-09-01T08:00:00.000Z", "en", now)).toMatch(/^updated 1 Sept?/);
  });

  it("builds fixture worlds as the same DTO shape (no Appwrite)", () => {
    for (const locale of ["ro", "en"] as const) {
      const worlds = fixtureStudioWorlds(locale);
      expect(worlds.length).toBeGreaterThan(0);
      for (const world of worlds) {
        expect(world).toMatchObject({
          id: expect.any(String),
          title: expect.any(String),
          status: expect.stringMatching(/^(draft|ready|published)$/),
          visualVariant: expect.stringMatching(/portrait|landscape|square/)
        });
        expect(world.href).toBe("");
      }
    }
    expect(fixtureStudioWorlds("en").map((world) => world.title)).toContain("The hidden garden");
  });

  it("maps every card crop to an editorial poster that exists in public/", () => {
    for (const variant of ["portrait", "landscape", "square"] as const) {
      expect(existsSync(join(process.cwd(), "public", editorialPosterSrc(variant)))).toBe(true);
    }
  });

  it("gives every fixture world a poster image that exists in public/", () => {
    for (const world of fixtureStudioWorlds("ro")) {
      expect(world.preview?.kind).toBe("safe-preview");
      const src = world.preview?.src ?? "";
      expect(src).toMatch(/^\/demo\/studio\/worlds\/[a-z]+\.webp$/);
      expect(existsSync(join(process.cwd(), "public", src))).toBe(true);
    }
  });
});
