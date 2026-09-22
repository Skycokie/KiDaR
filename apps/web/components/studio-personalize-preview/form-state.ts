/**
 * Local-only personalize state. No persistence, no network.
 */

import {
  ATMOSPHERES,
  CHARACTERS,
  EFFECTS,
  POSITIONS,
  SCALES,
  SOUNDS,
  type AtmosphereId,
  type CharacterId,
  type EffectId,
  type PositionId,
  type ScaleId,
  type SoundId
} from "./fixtures";

export type PersonalizeState = {
  character: CharacterId;
  effect: EffectId;
  atmosphere: AtmosphereId;
  sound: SoundId;
  position: PositionId;
  scale: ScaleId;
  showInWorld: boolean;
};

export function createInitialPersonalizeState(): PersonalizeState {
  return {
    character: "none",
    effect: "none",
    atmosphere: "morning",
    sound: "silence",
    position: "center",
    scale: "medium",
    showInWorld: true
  };
}

export function setCharacter(state: PersonalizeState, character: CharacterId): PersonalizeState {
  return { ...state, character };
}

export function setEffect(state: PersonalizeState, effect: EffectId): PersonalizeState {
  return { ...state, effect };
}

export function setAtmosphere(state: PersonalizeState, atmosphere: AtmosphereId): PersonalizeState {
  return { ...state, atmosphere };
}

export function setSound(state: PersonalizeState, sound: SoundId): PersonalizeState {
  return { ...state, sound };
}

export function setPosition(state: PersonalizeState, position: PositionId): PersonalizeState {
  return { ...state, position };
}

export function setScale(state: PersonalizeState, scale: ScaleId): PersonalizeState {
  return { ...state, scale };
}

export function setShowInWorld(state: PersonalizeState, showInWorld: boolean): PersonalizeState {
  return { ...state, showInWorld };
}

function labelOf<T extends string>(
  options: { id: T; label: string }[],
  id: T
): string {
  return options.find((item) => item.id === id)?.label ?? id;
}

/** Compact summary for the panel — e.g. "Fluture · Stele · Apus". */
export function summarizePersonalize(state: PersonalizeState): string {
  const parts: string[] = [];
  if (state.character !== "none") {
    parts.push(labelOf(CHARACTERS, state.character));
  }
  if (state.effect !== "none") {
    parts.push(labelOf(EFFECTS, state.effect));
  }
  parts.push(labelOf(ATMOSPHERES, state.atmosphere));
  if (state.sound !== "silence") {
    parts.push(labelOf(SOUNDS, state.sound));
  }
  if (parts.length === 0) {
    return "Nicio alegere încă";
  }
  return parts.join(" · ");
}

export function positionLabel(state: PersonalizeState): string {
  return labelOf(POSITIONS, state.position);
}

export function scaleLabel(state: PersonalizeState): string {
  return labelOf(SCALES, state.scale);
}

/**
 * Paths that must never be called from this preview.
 * Personalize Go B is presentation-only.
 */
export function isPersonalizeWriteBlocked(url: string): boolean {
  let path = url.split("?")[0] ?? url;
  try {
    path = new URL(url, "http://local.invalid").pathname;
  } catch {
    // keep split path
  }
  path = path.replace(/\/+$/, "") || "/";
  if (path.startsWith("/api/")) return true;
  return false;
}

/** Forbidden persistence keywords for audit tests. */
export const FORBIDDEN_PERSISTENCE_APIS = [
  "localStorage",
  "sessionStorage",
  "indexedDB",
  "caches"
] as const;

export const FORBIDDEN_COPY_SNIPPETS = ["Salvează", "Publică", "salvat", "publicat"] as const;
