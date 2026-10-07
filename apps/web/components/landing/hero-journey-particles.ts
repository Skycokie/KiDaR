/**
 * Pure particle formula for the homepage "kidAR story loop".
 *
 * ONE swarm morphs through six shapes in a 16 second loop:
 *   0 sketch (child drawing) -> 1 character -> 2 decor world -> 3 voice rings
 *   -> 4 AR phone -> 5 QR share -> back to the sketch.
 *
 * Ported from a generated simulator function. Differences on purpose:
 * - fixed controls (no sliders on the site),
 * - colors blend across transitions (no snap at the end of a blend),
 * - balloons bob smoothly instead of wrapping,
 * - QR cells are coherent (all particles in a cell agree),
 * - only the two active stage targets are computed per particle.
 *
 * Zero allocation in the hot path: shared scratch objects live at module level
 * (single threaded) and every output is finite.
 */

export type JourneyTarget = {
  set(x: number, y: number, z: number): void;
};

export type JourneyColor = {
  setHSL(h: number, s: number, l: number): void;
};

export const JOURNEY_LOOP_SECONDS = 16;
/** Frame used for the single static frame under prefers-reduced-motion (character). */
export const JOURNEY_STATIC_TIME = 4.5;

const TAU = 6.28318530718;
const SPARKLE = 0.5;
const SPREAD = 0.2;

type Vec = { x: number; y: number; z: number };
type Hsl = { h: number; s: number; l: number };

const shared = {
  count: 1,
  u: 0,
  h1: 0,
  h2: 0,
  h3: 0,
  t: 0,
  phase: 0,
  bob: 0,
  gx: 0,
  gy: 0,
  qrOn: false
};

const blendState = { a: 0, b: 0, blend: 0 };
const posA: Vec = { x: 0, y: 0, z: 0 };
const posB: Vec = { x: 0, y: 0, z: 0 };
const hslA: Hsl = { h: 0.12, s: 0.72, l: 0.39 };
const hslB: Hsl = { h: 0.12, s: 0.72, l: 0.39 };

function finite(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

/** Deterministic integer hash to [0, 1). No allocation. */
function hash01(n: number): number {
  let x = n | 0;
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}
function smooth(q: number): number {
  const c = Math.min(1, Math.max(0, q));
  return c * c * (3 - 2 * c);
}

/** Which two stages are active at this phase and how far the blend is. */
function resolveStages(phase: number): void {
  let a = 5;
  let b = 0;
  let q = 0;
  if (phase < 0.5) {
    a = 5;
    b = 0;
    q = phase + 0.5;
  } else if (phase < 2.5) {
    a = 0;
    b = 0;
  } else if (phase < 3.5) {
    a = 0;
    b = 1;
    q = phase - 2.5;
  } else if (phase < 5.5) {
    a = 1;
    b = 1;
  } else if (phase < 6.5) {
    a = 1;
    b = 2;
    q = phase - 5.5;
  } else if (phase < 8.5) {
    a = 2;
    b = 2;
  } else if (phase < 9.5) {
    a = 2;
    b = 3;
    q = phase - 8.5;
  } else if (phase < 10.5) {
    a = 3;
    b = 3;
  } else if (phase < 11.5) {
    a = 3;
    b = 4;
    q = phase - 10.5;
  } else if (phase < 13.5) {
    a = 4;
    b = 4;
  } else if (phase < 14.5) {
    a = 4;
    b = 5;
    q = phase - 13.5;
  } else if (phase < 15.5) {
    a = 5;
    b = 5;
  } else {
    a = 5;
    b = 0;
    q = phase - 15.5;
  }
  blendState.a = a;
  blendState.b = b;
  blendState.blend = smooth(q);
}

function sketchTarget(out: Vec): void {
  const u = shared.u;
  out.z = 0;
  if (u < 0.48) {
    const a = (u / 0.48) * TAU;
    out.x = Math.cos(a) * 0.23;
    out.y = 0.52 + Math.sin(a) * 0.23;
  } else if (u < 0.65) {
    const a = (u - 0.48) / 0.17;
    out.x = 0;
    out.y = 0.29 - a * 0.46;
  } else if (u < 0.79) {
    const a = (u - 0.65) / 0.14;
    out.x = -0.38 + a * 0.76;
    out.y = 0.12 - Math.abs(a - 0.5) * 0.22;
  } else if (u < 0.895) {
    const a = (u - 0.79) / 0.105;
    out.x = -0.18 - a * 0.13;
    out.y = -0.17 - a * 0.37;
  } else {
    const a = (u - 0.895) / 0.105;
    out.x = 0.18 + a * 0.13;
    out.y = -0.17 - a * 0.37;
  }
}

/** Head sphere share of the figure (0..HEAD_END of bodyU). */
const HEAD_END = 0.3;
const FIG_X = -0.12;

/**
 * Small 3D figure: head (sphere), raincoat (trapezoid), two arms, two legs, shoes.
 * bodyU 0..1 selects the part. Also used as the figure inside the decor/phone stages.
 */
function figureTarget(out: Vec, bodyU: number): void {
  const { h1, h2, h3, bob } = shared;
  const side = h3 < 0.5 ? -1 : 1;
  let cx = 0;
  let cy = 0;
  let cz = 0;
  if (bodyU < HEAD_END) {
    const z = (bodyU / HEAD_END) * 2 - 1;
    const r = Math.sqrt(Math.max(0, 1 - z * z));
    const a = h1 * TAU;
    cx = FIG_X + Math.cos(a) * 0.2 * r;
    cy = 0.55 + z * 0.21 + bob;
    cz = Math.sin(a) * 0.16 * r;
  } else if (bodyU < 0.58) {
    // Raincoat: a trapezoid that widens toward the hem.
    const drop = h2;
    const half = 0.12 + drop * 0.08;
    cx = FIG_X + (h1 * 2 - 1) * half;
    cy = 0.31 - drop * 0.43 + bob;
    cz = (h3 - 0.5) * 0.16;
  } else if (bodyU < 0.74) {
    // Arms: from the shoulders, angled down and out.
    cx = FIG_X + side * (0.13 + h1 * 0.2);
    cy = 0.25 - h1 * 0.11 + (h2 - 0.5) * 0.03 + bob;
    cz = (h2 - 0.5) * 0.06;
  } else if (bodyU < 0.92) {
    // Legs: two nearly vertical columns.
    cx = FIG_X + side * (0.07 + h1 * 0.025);
    cy = -0.12 - h2 * 0.4 + bob;
    cz = (h3 - 0.5) * 0.07;
  } else {
    // Shoes.
    cx = FIG_X + side * (0.09 + (h1 - 0.3) * 0.1);
    cy = -0.54 - h2 * 0.03 + bob;
    cz = (h3 - 0.5) * 0.08 + 0.02;
  }
  const rel = cx - FIG_X;
  const turn = Math.sin(shared.t * 0.7) * 0.035;
  out.x = FIG_X + rel * Math.cos(turn) - cz * Math.sin(turn);
  out.y = cy;
  out.z = rel * Math.sin(turn) + cz * Math.cos(turn);
}
function characterTarget(out: Vec): void {
  figureTarget(out, shared.u);
}

/** Share of the swarm used by each decor part (u ranges). */
const FIGURE_END = 0.22;
const HOUSE_END = 0.34;
const TREE_END = 0.46;
const GRASS_END = 0.62;
const STARS_END = 0.8;

const STAR_CENTERS_X = [-0.7, 0.2, 0.66, 0.84, -0.84];
const STAR_CENTERS_Y = [0.62, 0.8, 0.56, 0.16, 0.2];
const STAR_RADIUS = [0.15, 0.115, 0.165, 0.1, 0.1];
const BALLOON_X = [0.32, 0.54, 0.74];
const BALLOON_Y = [0.34, 0.5, 0.3];

/** Figure + house + tree + grass + stars + balloons. */
function decorTarget(out: Vec): void {
  const { u, h1, h2, h3, t } = shared;
  if (u < FIGURE_END) {
    // The same figure as the character stage.
    figureTarget(out, u / FIGURE_END);
  } else if (u < HOUSE_END) {
    // House: filled walls plus a filled triangular roof.
    const p = (u - FIGURE_END) / (HOUSE_END - FIGURE_END);
    if (p < 0.55) {
      out.x = 0.48 + h1 * 0.34;
      out.y = -0.78 + h2 * 0.38;
    } else {
      const half = 0.21 * (1 - h2);
      out.x = 0.65 + (h1 * 2 - 1) * half;
      out.y = -0.4 + h2 * 0.28;
    }
    out.z = (h3 - 0.5) * 0.1;
  } else if (u < TREE_END) {
    // Tree: trunk, then a round canopy.
    const p = (u - HOUSE_END) / (TREE_END - HOUSE_END);
    if (p < 0.3) {
      out.x = -0.65 + (h1 - 0.5) * 0.07;
      out.y = -0.78 + h2 * 0.36;
    } else {
      const a = h1 * TAU;
      const r = 0.2 * Math.sqrt(h2);
      out.x = -0.65 + Math.cos(a) * r + Math.sin(t * 0.8) * 0.006;
      out.y = -0.16 + Math.sin(a) * r;
    }
    out.z = (h3 - 0.5) * 0.1;
  } else if (u < GRASS_END) {
    // Grass strip with short blades.
    const x = -0.9 + h1 * 1.8;
    out.x = x;
    out.y = -0.88 + Math.sin(x * 11 + t * 0.6) * 0.012 + h2 * h2 * 0.09;
    out.z = (h3 - 0.5) * 0.12;
  } else if (u < STARS_END) {
    // Stars: five-point filled stars at fixed spots that twinkle.
    const id = Math.min(4, Math.floor(h3 * 5));
    const a = h1 * TAU;
    const spike = Math.abs(Math.cos(2.5 * (a - 1.5707963)));
    const radius = STAR_RADIUS[id] * (1 + 0.12 * Math.sin(t * 2 + id * 1.7)) * (0.3 + 0.7 * spike * spike * spike) * Math.sqrt(h2);
    out.x = STAR_CENTERS_X[id] + Math.cos(a) * radius;
    out.y = STAR_CENTERS_Y[id] + Math.sin(a) * radius;
    out.z = (h2 - 0.5) * 0.05;
  } else {
    // Balloons: ellipses on a string, bobbing gently.
    const id = Math.min(2, Math.floor(h3 * 3));
    const bob = Math.sin(t * 1.1 + id * 2) * 0.04;
    if (h2 > 0.86) {
      const k = (h2 - 0.86) / 0.14;
      out.x = BALLOON_X[id] + Math.sin(k * 3 + t) * 0.01;
      out.y = BALLOON_Y[id] - 0.1 - k * 0.2 + bob;
    } else {
      const a = h1 * TAU;
      const r = Math.sqrt(h2 / 0.86);
      out.x = BALLOON_X[id] + Math.cos(a) * 0.075 * r;
      out.y = BALLOON_Y[id] + Math.sin(a) * 0.095 * r + bob;
    }
    out.z = (h1 - 0.5) * 0.06;
  }
}
/** Decor stays for the first 55%, the rest radiates as sound rings from the head. */
function voiceTarget(out: Vec): void {
  const { u, h1, t, phase } = shared;
  if (u < 0.55) {
    decorTarget(out);
    return;
  }
  const ringU = (u - 0.55) / 0.45;
  const ring = Math.min(3, Math.floor(ringU * 4));
  const angle = h1 * TAU;
  const radius = 0.31 + ring * 0.17 + Math.max(0, phase - 9) * 0.07;
  out.x = -0.12 + Math.cos(angle) * radius;
  out.y = 0.55 + Math.sin(angle) * radius;
  out.z = Math.sin(angle * 2 + t) * 0.025;
}

function phoneTarget(out: Vec): void {
  const { u, h1, h2, t } = shared;
  if (u < 0.52) {
    // The whole world shrinks into the screen.
    decorTarget(out);
    out.x *= 0.42;
    out.y *= 0.48;
    out.z *= 0.42;
  } else if (u < 0.86) {
    // Rounded phone body.
    const a = ((u - 0.52) / 0.34) * TAU;
    const c = Math.cos(a);
    const s = Math.sin(a);
    out.x = Math.sign(c) * Math.sqrt(Math.abs(c)) * 0.47;
    out.y = Math.sign(s) * Math.sqrt(Math.abs(s)) * 0.88;
    out.z = Math.sin(a * 3 + t) * 0.012;
  } else if (u < 0.91) {
    // Camera lens.
    const a = h1 * TAU;
    const r = 0.055 + h2 * 0.035;
    out.x = -0.27 + Math.cos(a) * r;
    out.y = 0.72 + Math.sin(a) * r;
    out.z = 0.04;
  } else if (u < 0.94) {
    // Side button.
    out.x = -0.49;
    out.y = 0.08 + h1 * 0.22;
    out.z = 0;
  } else if (u < 0.97) {
    // Front island.
    const a = h1 * TAU;
    out.x = Math.cos(a) * 0.075;
    out.y = 0.79 + Math.sin(a) * 0.035;
    out.z = 0.05;
  } else {
    // AR scanning corner brackets.
    const p = (u - 0.97) / 0.03;
    const side = Math.min(3, Math.floor(p * 4));
    const k = (p * 4) % 1;
    out.x = (side % 2 === 0 ? -0.39 : 0.27) + k * 0.12;
    out.y = side < 2 ? 0.67 : -0.67;
    out.z = 0.06;
  }
}

/** QR-like grid: 25 x 25 modules (version 2 size) with three finder squares. */
const QR_N = 25;
const QR_SIZE = 1.3;

function qrCell(): void {
  const cells = QR_N * QR_N;
  const grid = Math.min(cells - 1, Math.floor(shared.u * cells));
  const gx = grid % QR_N;
  const gy = Math.floor(grid / QR_N);
  shared.gx = gx;
  shared.gy = gy;
  const hi = QR_N - 7;
  const inFinder = (gx < 7 && gy < 7) || (gx >= hi && gy < 7) || (gx < 7 && gy >= hi);
  if (inFinder) {
    const fx = gx < 7 ? gx : gx - hi;
    const fy = gy < 7 ? gy : gy - hi;
    const edge = Math.min(fx, 6 - fx, fy, 6 - fy);
    shared.qrOn = edge === 0 || (fx >= 2 && fx <= 4 && fy >= 2 && fy <= 4);
  } else {
    // Coherent per cell, so every particle of a cell agrees.
    shared.qrOn = ((gx * 73 + gy * 151 + gx * gy * 31) % 97) / 97 > 0.48;
  }
}

function qrTarget(out: Vec): void {
  const span = QR_N - 1;
  out.x = (shared.gx / span - 0.5) * QR_SIZE + (shared.h1 - 0.5) * 0.026;
  out.y = (0.5 - shared.gy / span) * QR_SIZE + (shared.h2 - 0.5) * 0.026;
  out.z = (shared.h3 - 0.5) * 0.035;
}
function stageTarget(stage: number, out: Vec): void {
  if (stage === 1) characterTarget(out);
  else if (stage === 2) decorTarget(out);
  else if (stage === 3) voiceTarget(out);
  else if (stage === 4) phoneTarget(out);
  else if (stage === 5) qrTarget(out);
  else sketchTarget(out);
}

function figureColor(figU: number, sparkleLit: number, out: Hsl): void {
  out.h = 0.12;
  out.s = 0.72;
  out.l = sparkleLit;
  if (figU < HEAD_END) {
    const z = (figU / HEAD_END) * 2 - 1;
    if (z > 0.45) {
      // Hair.
      out.h = 0.75;
      out.s = 0.55;
      out.l = 0.31;
    } else {
      // Skin.
      out.h = 0.075;
      out.s = 0.62;
      out.l = 0.43;
    }
  } else if (figU >= 0.92) {
    // Shoes.
    out.h = 0.06;
    out.s = 0.7;
    out.l = 0.4;
  } else if (figU >= 0.74) {
    // Trousers.
    out.h = 0.74;
    out.s = 0.5;
    out.l = 0.34;
  }
  // Raincoat and arms keep the storybook yellow.
}

/** Colors of the house, tree, grass, stars and balloons (u >= FIGURE_END). */
function decorColor(sparkleLit: number, out: Hsl): void {
  const { u, h2, h3 } = shared;
  out.h = 0.12;
  out.s = 0.72;
  out.l = sparkleLit;
  if (u < HOUSE_END) {
    const p = (u - FIGURE_END) / (HOUSE_END - FIGURE_END);
    if (p >= 0.55) {
      // Roof.
      out.h = 0.05;
      out.s = 0.7;
      out.l = 0.38;
    }
  } else if (u < TREE_END) {
    const p = (u - HOUSE_END) / (TREE_END - HOUSE_END);
    if (p < 0.3) {
      // Trunk.
      out.h = 0.07;
      out.s = 0.55;
      out.l = 0.31;
    } else {
      // Canopy.
      out.h = 0.27;
      out.s = 0.5;
      out.l = 0.34;
    }
  } else if (u < GRASS_END) {
    out.h = 0.27;
    out.s = 0.55;
    out.l = 0.33;
  } else if (u < STARS_END) {
    out.h = 0.13;
    out.s = 0.85;
    out.l = 0.48 + SPARKLE * 0.06 * Math.sin(shared.t * 3 + h2 * 9);
  } else {
    const id = Math.min(2, Math.floor(h3 * 3));
    out.h = id === 0 ? 0.06 : id === 1 ? 0.75 : 0.5;
    out.s = 0.68;
    out.l = h2 > 0.86 ? 0.3 : 0.4;
  }
}

function stageColor(stage: number, out: Hsl): void {
  const { u, h1, t, count } = shared;
  const sparkleLit = 0.39 + SPARKLE * (0.035 + 0.045 * Math.sin(t * 4 + h1 * 20));
  out.h = 0.12;
  out.s = 0.72;
  out.l = sparkleLit;
  // The figure is the character (stage 1) and the first part of the decor/voice/phone stages.
  const figU = stage === 1 ? u : stage >= 2 && stage <= 4 && u < FIGURE_END ? u / FIGURE_END : -1;
  if (figU >= 0) {
    figureColor(figU, sparkleLit, out);
  } else if (stage === 2 || (stage === 3 && u < 0.55) || (stage === 4 && u < 0.52)) {
    decorColor(sparkleLit, out);
  } else if (stage === 3 && u >= 0.55) {
    // Voice rings.
    out.h = 0.75;
    out.s = 0.62;
    out.l = 0.42 + SPARKLE * 0.05;
  } else if (stage === 4 && u >= 0.97) {
    // AR scanning brackets.
    out.h = 0.5;
    out.s = 0.64;
    out.l = 0.4 + SPARKLE * 0.04;
  } else if (stage === 0) {
    // Continuous across the 16s wrap: the end of the loop counts as negative time.
    const clock = shared.phase >= 12 ? shared.phase - JOURNEY_LOOP_SECONDS : shared.phase;
    const progress = Math.min(1, Math.max(0, clock / 3));
    const tip = Math.max(0, 1 - Math.abs(u - progress) * count * 0.018);
    out.l = u < progress ? 0.36 + tip * SPARKLE * 0.16 : 0.285;
    out.h = 0.12;
    out.s = 0.78;
  } else if (stage === 5 && !shared.qrOn) {
    // Light QR modules stay almost invisible, so the dark/bright pattern reads clearly.
    // (Three interprets HSL in linear space, so 0.02 renders as a very dark tone.)
    out.s = 0.4;
    out.l = 0.02;
  }
}
export function journeyParticle(
  i: number,
  count: number,
  time: number,
  target: JourneyTarget,
  color: JourneyColor
): void {
  const n = count > 0 ? count : 1;
  const idx = ((finite(i, 0) % n) + n) % n;
  const t = finite(time, 0);
  const phase = ((t % JOURNEY_LOOP_SECONDS) + JOURNEY_LOOP_SECONDS) % JOURNEY_LOOP_SECONDS;

  shared.count = n;
  shared.u = (idx + 0.5) / n;
  // Integer-hash noise: low-discrepancy sequences (golden ratio / R2) correlate with the index,
  // which shows up as spiral/hatch moire in the swarm. Noise reads as a living swarm instead.
  shared.h1 = hash01(idx * 3 + 1);
  shared.h2 = hash01(idx * 3 + 2);
  shared.h3 = hash01(idx * 3 + 3);
  shared.t = t;
  shared.phase = phase;
  shared.bob = Math.sin(t * 2.2) * 0.025;
  qrCell();

  resolveStages(phase);
  const { a, b, blend } = blendState;
  stageTarget(a, posA);
  stageTarget(b, posB);

  const wobble = Math.sin(t * 1.7 + shared.h1 * TAU) * 0.012;
  const jitter = SPREAD * 0.018;
  const jx = (Math.sin(shared.h1 * 91.7 + t * 1.3) + Math.cos(shared.h2 * 73.1 - t)) * jitter * 0.5;
  const jy = (Math.cos(shared.h2 * 83.3 + t * 1.1) + Math.sin(shared.h3 * 67.9 - t)) * jitter * 0.5;
  const jz = Math.sin(shared.h3 * 89.1 + t * 1.5) * (0.008 + jitter * 0.5);

  target.set(
    finite(posA.x + (posB.x - posA.x) * blend + jx + wobble),
    finite(posA.y + (posB.y - posA.y) * blend + jy),
    finite(posA.z + (posB.z - posA.z) * blend + jz)
  );

  stageColor(a, hslA);
  stageColor(b, hslB);
  const hue = blend < 0.5 ? hslA.h : hslB.h;
  const sat = hslA.s + (hslB.s - hslA.s) * blend;
  let lit = hslA.l + (hslB.l - hslA.l) * blend;
  lit += blend * 0.012 * Math.sin(t * 5 + shared.h2 * 12);
  color.setHSL(
    finite(hue, 0.12),
    Math.min(1, Math.max(0, finite(sat, 0.7))),
    Math.min(0.58, Math.max(0.01, finite(lit, 0.4)))
  );
}

/** Small swarms for the homepage (the generator used 20k; the page does not need it). */
export function journeyParticleCountForViewport(width: number, mobileMax = 699): number {
  const w = finite(width, 1024);
  return w <= mobileMax ? 1200 : 2600;
}
