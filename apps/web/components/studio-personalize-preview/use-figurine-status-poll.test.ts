import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const hookSource = readFileSync(join(__dirname, "use-figurine-status-poll.ts"), "utf8");
const cardSource = readFileSync(join(__dirname, "figurine-generate-card.tsx"), "utf8");
const stageSource = readFileSync(join(__dirname, "figurine-live-stage.tsx"), "utf8");

describe("figurine status polling", () => {
  it("restarts the card poll loop after a successful generate click", () => {
    expect(cardSource).toMatch(/setPollEpoch/);
    expect(cardSource).toMatch(/useFigurineStatusPoll\(projectId,\s*pollEpoch\)/);
    expect(cardSource).toMatch(/startFigurineGeneration/);
  });

  it("keeps the live stage polling while mounted so regenerates are observed", () => {
    expect(stageSource).toMatch(/useFigurineStatusPoll\(projectId,\s*0,\s*true\)/);
    expect(hookSource).toMatch(/keepAlive/);
  });
});
