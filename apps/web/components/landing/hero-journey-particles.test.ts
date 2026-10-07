import { describe, expect, it } from "vitest";
import {
  JOURNEY_LOOP_SECONDS,
  JOURNEY_STATIC_TIME,
  journeyParticle,
  journeyParticleCountForViewport
} from "./hero-journey-particles";

type Sample = { x: number; y: number; z: number; h: number; s: number; l: number };

function sample(i: number, count: number, time: number): Sample {
  const out: Sample = { x: NaN, y: NaN, z: NaN, h: NaN, s: NaN, l: NaN };
  journeyParticle(
    i,
    count,
    time,
    {
      set(x, y, z) {
        out.x = x;
        out.y = y;
        out.z = z;
      }
    },
    {
      setHSL(h, s, l) {
        out.h = h;
        out.s = s;
        out.l = l;
      }
    }
  );
  return out;
}

function allFinite(s: Sample): boolean {
  return [s.x, s.y, s.z, s.h, s.s, s.l].every(Number.isFinite);
}

describe("journeyParticle", () => {
  it("writes finite positions and colors through the whole loop", () => {
    const count = 900;
    for (let time = 0; time < JOURNEY_LOOP_SECONDS * 2; time += 0.37) {
      for (let i = 0; i < count; i += 7) {
        const s = sample(i, count, time);
        expect(allFinite(s)).toBe(true);
        expect(Math.abs(s.x)).toBeLessThan(1.6);
        expect(Math.abs(s.y)).toBeLessThan(1.6);
        expect(Math.abs(s.z)).toBeLessThan(0.5);
      }
    }
  });

  it("never produces near-white particles and keeps the palette in range", () => {
    const count = 600;
    for (let time = 0; time < JOURNEY_LOOP_SECONDS; time += 0.5) {
      for (let i = 0; i < count; i += 3) {
        const s = sample(i, count, time);
        expect(s.l).toBeGreaterThanOrEqual(0.01);
        expect(s.l).toBeLessThanOrEqual(0.58);
        expect(s.s).toBeGreaterThanOrEqual(0);
        expect(s.s).toBeLessThanOrEqual(1);
      }
    }
  });

  it("stays finite for degenerate input", () => {
    for (const [i, count, time] of [
      [0, 1, 0],
      [0, 0, 5],
      [-3, 10, 1e6],
      [5, 10, -1e6],
      [2, 10, Number.NaN],
      [Number.NaN, 10, 1]
    ] as const) {
      expect(allFinite(sample(i, count, time))).toBe(true);
    }
  });

  it("loops seamlessly: no jump when the 16 second phase wraps", () => {
    const count = 500;
    for (let i = 5; i < count; i += 5) {
      const before = sample(i, count, JOURNEY_LOOP_SECONDS - 0.005);
      const after = sample(i, count, JOURNEY_LOOP_SECONDS + 0.005);
      expect(Math.hypot(after.x - before.x, after.y - before.y, after.z - before.z)).toBeLessThan(0.05);
      expect(Math.abs(after.l - before.l)).toBeLessThan(0.02);
    }
  });
  it("moves smoothly frame to frame (no popping)", () => {
    const count = 800;
    const dt = 1 / 60;
    let worst = 0;
    for (let time = 0; time < JOURNEY_LOOP_SECONDS; time += 0.25) {
      for (let i = 0; i < count; i += 3) {
        const a = sample(i, count, time);
        const b = sample(i, count, time + dt);
        worst = Math.max(worst, Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z));
      }
    }
    expect(worst).toBeLessThan(0.1);
  });

  it("changes color smoothly across stage transitions", () => {
    const count = 800;
    // Windows after the pencil sweep (the sweep itself is a deliberate flash).
    const windows = [[3.0, 3.6], [5.4, 6.6], [8.4, 9.6], [10.4, 11.6], [13.4, 14.6]];
    let worst = 0;
    for (const [from, to] of windows) {
      for (let time = from; time < to; time += 0.02) {
        for (let i = 0; i < count; i += 11) {
          const a = sample(i, count, time);
          const b = sample(i, count, time + 0.02);
          worst = Math.max(worst, Math.abs(b.l - a.l));
        }
      }
    }
    expect(worst).toBeLessThan(0.05);
  });
  it("static frame shows the character (head and body inside the scene)", () => {
    const count = 900;
    let inside = 0;
    for (let i = 0; i < count; i += 1) {
      const s = sample(i, count, JOURNEY_STATIC_TIME);
      if (Math.abs(s.x) < 0.5 && s.y > -0.6 && s.y < 0.85) inside += 1;
    }
    expect(inside).toBeGreaterThan(count * 0.9);
  });
});

describe("journeyParticleCountForViewport", () => {
  it("uses a lighter budget on mobile", () => {
    expect(journeyParticleCountForViewport(390)).toBe(1200);
    expect(journeyParticleCountForViewport(699)).toBe(1200);
    expect(journeyParticleCountForViewport(1200)).toBe(2600);
  });
});
