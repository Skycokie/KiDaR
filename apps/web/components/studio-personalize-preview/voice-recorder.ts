/**
 * Browser MediaRecorder helper for Studio voice clips.
 * Caps at 30 seconds; prefers audio/webm.
 */

import { CHARACTER_VOICE_AUDIO_MAX_SECONDS } from "@kidar/core";

export type VoiceRecorderError = "unsupported" | "permission" | "generic";

export type VoiceRecorderStopResult =
  | { ok: true; file: File; durationMs: number }
  | { ok: false; error: VoiceRecorderError };

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4"
  ];
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return undefined;
}

export function isVoiceRecordingSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof MediaRecorder !== "undefined"
  );
}

export type VoiceRecorderSession = {
  stop: () => Promise<VoiceRecorderStopResult>;
  cancel: () => void;
};

/**
 * Starts mic capture. Caller must call stop() or cancel().
 * Auto-stops after CHARACTER_VOICE_AUDIO_MAX_SECONDS.
 */
export async function startVoiceRecording(
  maxSeconds = CHARACTER_VOICE_AUDIO_MAX_SECONDS
): Promise<
  { ok: true; session: VoiceRecorderSession } | { ok: false; error: VoiceRecorderError }
> {
  if (!isVoiceRecordingSupported()) {
    return { ok: false, error: "unsupported" };
  }

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (cause) {
    const name = cause instanceof DOMException ? cause.name : "";
    if (name === "NotAllowedError" || name === "PermissionDeniedError") {
      return { ok: false, error: "permission" };
    }
    return { ok: false, error: "generic" };
  }

  const mimeType = pickMimeType();
  let recorder: MediaRecorder;
  try {
    recorder = mimeType
      ? new MediaRecorder(stream, { mimeType })
      : new MediaRecorder(stream);
  } catch {
    for (const track of stream.getTracks()) track.stop();
    return { ok: false, error: "unsupported" };
  }

  const chunks: BlobPart[] = [];
  const startedAt = Date.now();
  let settle: ((result: VoiceRecorderStopResult) => void) | null = null;
  let settled = false;
  let autoTimer: ReturnType<typeof setTimeout> | null = null;

  const finish = (result: VoiceRecorderStopResult) => {
    if (settled) return;
    settled = true;
    if (autoTimer) clearTimeout(autoTimer);
    for (const track of stream.getTracks()) track.stop();
    settle?.(result);
  };

  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };

  recorder.onerror = () => {
    finish({ ok: false, error: "generic" });
  };

  recorder.onstop = () => {
    if (settled && !settle) return;
    const type = recorder.mimeType || mimeType || "audio/webm";
    const blob = new Blob(chunks, { type });
    if (blob.size < 1) {
      finish({ ok: false, error: "generic" });
      return;
    }
    const extension = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
    const file = new File([blob], `voice-${Date.now()}.${extension}`, { type });
    finish({ ok: true, file, durationMs: Date.now() - startedAt });
  };

  try {
    recorder.start(250);
  } catch {
    for (const track of stream.getTracks()) track.stop();
    return { ok: false, error: "generic" };
  }

  const stopPromise = new Promise<VoiceRecorderStopResult>((resolve) => {
    settle = resolve;
  });

  autoTimer = setTimeout(() => {
    if (recorder.state === "recording") recorder.stop();
  }, Math.max(1, maxSeconds) * 1000);

  return {
    ok: true,
    session: {
      stop: async () => {
        if (recorder.state === "recording" || recorder.state === "paused") {
          recorder.stop();
        } else if (!settled) {
          finish({ ok: false, error: "generic" });
        }
        return stopPromise;
      },
      cancel: () => {
        try {
          if (recorder.state === "recording" || recorder.state === "paused") {
            recorder.onstop = null;
            recorder.stop();
          }
        } catch {
          // ignore
        }
        finish({ ok: false, error: "generic" });
      }
    }
  };
}
