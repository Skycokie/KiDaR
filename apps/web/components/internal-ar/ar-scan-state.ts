/**
 * Pure state machine for the staging AR drawing-scan preflight.
 * No camera, network, or DOM — unit-testable.
 */

export const AR_SCAN_STATES = [
  "idle",
  "camera",
  "recognized",
  "timeout",
  "unavailable",
  "projecting"
] as const;

export type ArScanState = (typeof AR_SCAN_STATES)[number];

export type ArScanEvent =
  | { type: "START_CAMERA" }
  | { type: "CAMERA_UNAVAILABLE"; reason?: string }
  | { type: "MATCH_STABLE" }
  | { type: "SCAN_TIMEOUT" }
  | { type: "CONTINUE_WITHOUT_SCAN" }
  | { type: "PROJECT" }
  | { type: "RESET" };

export type ArScanTransition = {
  state: ArScanState;
  reason?: string;
};

export function reduceArScanState(
  current: ArScanState,
  event: ArScanEvent
): ArScanTransition {
  switch (event.type) {
    case "RESET":
      return { state: "idle" };
    case "START_CAMERA":
      if (current === "idle" || current === "timeout" || current === "unavailable") {
        return { state: "camera" };
      }
      return { state: current };
    case "CAMERA_UNAVAILABLE":
      if (current === "idle" || current === "camera") {
        return { state: "unavailable", reason: event.reason };
      }
      return { state: current, reason: event.reason };
    case "MATCH_STABLE":
      if (current === "camera") return { state: "recognized" };
      return { state: current };
    case "SCAN_TIMEOUT":
      if (current === "camera") return { state: "timeout" };
      return { state: current };
    case "CONTINUE_WITHOUT_SCAN":
      if (
        current === "idle" ||
        current === "camera" ||
        current === "timeout" ||
        current === "unavailable"
      ) {
        return { state: "projecting" };
      }
      return { state: current };
    case "PROJECT":
      if (current === "recognized" || current === "timeout" || current === "unavailable") {
        return { state: "projecting" };
      }
      return { state: current };
    default:
      return { state: current };
  }
}

export function arScanPrimaryLabel(state: ArScanState): string {
  switch (state) {
    case "idle":
      return "Pornește camera";
    case "camera":
      return "Ține desenul complet în cadru și mișcă telefonul ușor.";
    case "recognized":
      return "Desen recunoscut ✓";
    case "timeout":
      return "Nu am confirmat desenul încă";
    case "unavailable":
      return "Scanarea nu este disponibilă în acest build de staging";
    case "projecting":
      return "Se pregătește figurina…";
  }
}

export function arScanIdleCopy(): string {
  return "Scanează desenul original pentru a pregăti figurina.";
}

export function arScanHonestyCopy(): string {
  return "Recunoașterea desenului pregătește figurina. Plasarea se face apoi pe o suprafață reală.";
}

export function canStartCamera(state: ArScanState): boolean {
  return state === "idle" || state === "timeout" || state === "unavailable";
}

export function canProjectFigurine(state: ArScanState): boolean {
  return state === "recognized";
}

export function canContinueWithoutScan(state: ArScanState): boolean {
  return (
    state === "idle" ||
    state === "camera" ||
    state === "timeout" ||
    state === "unavailable"
  );
}
