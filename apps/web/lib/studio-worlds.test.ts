import { describe, expect, it } from "vitest";
import {
  artKindFromId,
  fixtureStudioWorlds,
  formatStudioUpdatedLabel,
  normalizeStudioWorldStatus,
  toStudioWorldCard,
  visualVariantFromId
} from "./studio-worlds";

describe("studio-worlds DTO mapping", () => {
  it("normalizes status into human Romanian labels", () => {
    expect(normalizeStudioWorldStatus("draft")).toBe("În lucru");
    expect(normalizeStudioWorldStatus("processing")).toBe("În lucru");
    expect(normalizeStudioWorldStatus("error")).toBe("În lucru");
    expect(normalizeStudioWorldStatus("ready")).toBe("Pregătit");
    expect(normalizeStudioWorldStatus("published")).toBe("Publicat");
    expect(
      normalizeStudioWorldStatus("ready", { publicExperienceUrl: "https://example.com/ar/x" })
    ).toBe("Publicat");
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
      href: "/studio/abc123",
      status: "În lucru",
      updatedLabel: expect.any(String),
      visualVariant: visualVariantFromId("abc123")
    });
    expect(card).not.toHaveProperty("uploadModelPath");
    expect(card).not.toHaveProperty("source_image_path");
    expect(card.preview).toBeUndefined();
  });

  it("derives stable editorial variants from id", () => {
    expect(visualVariantFromId("proj-a")).toBe(visualVariantFromId("proj-a"));
    expect(["portrait", "landscape", "square"]).toContain(visualVariantFromId("proj-a"));
    expect(["aurora", "garden", "kite"]).toContain(artKindFromId("proj-a"));
  });

  it("formats updated labels in Romanian without technical ids", () => {
    const now = new Date("2026-09-20T12:00:00.000Z");
    expect(formatStudioUpdatedLabel("2026-09-20T08:00:00.000Z", now)).toBe("actualizat azi");
    expect(formatStudioUpdatedLabel("2026-09-19T08:00:00.000Z", now)).toBe("actualizat ieri");
    expect(formatStudioUpdatedLabel("2026-09-01T08:00:00.000Z", now)).toMatch(/^actualizat /);
  });

  it("builds fixture worlds as the same DTO shape (no Appwrite)", () => {
    const worlds = fixtureStudioWorlds();
    expect(worlds.length).toBeGreaterThan(0);
    for (const world of worlds) {
      expect(world).toMatchObject({
        id: expect.any(String),
        title: expect.any(String),
        status: expect.stringMatching(/În lucru|Pregătit|Publicat/),
        visualVariant: expect.stringMatching(/portrait|landscape|square/)
      });
      expect(world.href).toBe("");
    }
  });
});
