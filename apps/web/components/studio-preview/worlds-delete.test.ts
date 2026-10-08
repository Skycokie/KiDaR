import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const shellSource = readFileSync(join(__dirname, "studio-shell.tsx"), "utf8");
const cssSource = readFileSync(join(__dirname, "studio-preview.css"), "utf8");
const routeSource = readFileSync(
  join(__dirname, "../../app/api/projects/[projectId]/route.ts"),
  "utf8"
);

describe("Studio world delete", () => {
  it("offers delete only on live cards, with a confirm dialog", () => {
    expect(shellSource).toMatch(/canDelete = result\.kind === "live"/);
    expect(shellSource).toMatch(/world-poster__delete/);
    expect(shellSource).toMatch(/role="dialog"/);
    expect(shellSource).toMatch(/deleteConfirmPublished/);
    expect(shellSource).toMatch(/method:\s*"DELETE"/);
    expect(cssSource).toMatch(/\.world-poster__delete/);
    expect(cssSource).toMatch(/\.world-delete-dialog/);
  });

  it("DELETE cleans voice audio and enqueues unpublish for published worlds", () => {
    expect(routeSource).toMatch(/collectCharacterVoiceAudioPaths/);
    expect(routeSource).toMatch(/projectNeedsUnpublish/);
    expect(routeSource).toMatch(/type:\s*"unpublish"/);
    expect(routeSource).toMatch(/enqueueJob/);
  });
});
