import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "camera-view-client.tsx"), "utf8");

describe("CameraViewClient", () => {
  it("applies the Studio pose and lets the finger orbit the model freely", () => {
    expect(source).toContain("orientation={orientation}");
    expect(source).toContain('touch-action="none"');
    expect(source).toContain('camera-orbit="auto auto auto"');
    expect(source).toContain('field-of-view="30deg"');
    expect(source).toContain('min-camera-orbit="auto auto 40%"');
    expect(source).toContain('max-camera-orbit="auto auto 200%"');
    expect(source).toContain('interaction-prompt="auto"');
    expect(source).not.toContain('touch-action="pan-y"');
  });
});
