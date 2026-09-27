"use client";

import { useEffect, useRef, useState } from "react";
import {
  CHARACTER_VOICE_MESSAGE_MAX,
  PRIMARY_CHARACTER_ID,
  type CharacterVoiceRole
} from "@kidar/core";
import { COPY } from "./fixtures";
import {
  VOICE_ERROR_COPY,
  deleteCharacterVoice,
  readCharacterVoiceStatus,
  saveCharacterVoice,
  uploadCharacterVoiceAudioFile,
  type VoiceClientError,
  type VoiceStatusView
} from "./character-voice-client";
import {
  VOICE_RECORDER_ERROR_COPY,
  isVoiceRecordingSupported,
  startVoiceRecording,
  type VoiceRecorderError,
  type VoiceRecorderSession
} from "./voice-recorder";

export type VoiceDraft = { role: CharacterVoiceRole; message: string };

export function VoiceCard({
  projectId,
  hasDrawing,
  onVoiceChange,
  onDraftChange,
  onPlay
}: {
  projectId?: string | null;
  hasDrawing: boolean;
  onVoiceChange?: (status: VoiceStatusView | null) => void;
  /** Unsaved role/message so the stage previews what the card shows; null when the card closes. */
  onDraftChange?: (draft: VoiceDraft | null) => void;
  /** Plays through the stage's single Audio so a preview never overlaps stage playback. */
  onPlay: (url: string) => void;
}) {
  const [role, setRole] = useState<CharacterVoiceRole>("narrator");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<VoiceStatusView | null>(null);
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string>("");
  const [note, setNote] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sessionRef = useRef<VoiceRecorderSession | null>(null);

  useEffect(() => {
    if (!projectId) {
      setStatus(null);
      onVoiceChange?.(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const result = await readCharacterVoiceStatus(projectId, PRIMARY_CHARACTER_ID);
      if (cancelled) return;
      if (!result.ok) {
        setError(VOICE_ERROR_COPY[result.error]);
        return;
      }
      setStatus(result.status);
      onVoiceChange?.(result.status);
      if (result.status.voice) {
        setRole(result.status.voice.role);
        setMessage(result.status.voice.message);
      }
    })();
    return () => {
      cancelled = true;
      sessionRef.current?.cancel();
      sessionRef.current = null;
    };
  }, [projectId, onVoiceChange]);

  useEffect(() => {
    onDraftChange?.({ role, message });
  }, [role, message, onDraftChange]);

  useEffect(() => () => onDraftChange?.(null), [onDraftChange]);

  if (!projectId) {
    return <p className="studio-ws__muted">{COPY.voiceNeedsProject}</p>;
  }
  if (!hasDrawing) {
    return <p className="studio-ws__muted">{COPY.voiceNeedsDrawing}</p>;
  }

  const remaining = CHARACTER_VOICE_MESSAGE_MAX - message.length;
  const canRecord = isVoiceRecordingSupported();

  async function persistVoice() {
    setBusy(true);
    setError("");
    setNote("");
    const result = await saveCharacterVoice(projectId!, { role, message });
    setBusy(false);
    if (!result.ok) {
      setError(VOICE_ERROR_COPY[result.error]);
      return;
    }
    setStatus(result.status);
    onVoiceChange?.(result.status);
    setNote(COPY.voiceSaved);
  }

  async function uploadFile(file: File) {
    setBusy(true);
    setError("");
    setNote("");
    const draftChanged =
      !status?.voice || status.voice.role !== role || status.voice.message !== message.trim();
    if (draftChanged) {
      const saved = await saveCharacterVoice(projectId!, { role, message });
      if (!saved.ok) {
        setBusy(false);
        setError(VOICE_ERROR_COPY[saved.error]);
        return;
      }
      setStatus(saved.status);
      onVoiceChange?.(saved.status);
    }
    const result = await uploadCharacterVoiceAudioFile(projectId!, file);
    setBusy(false);
    if (!result.ok) {
      setError(VOICE_ERROR_COPY[result.error]);
      return;
    }
    setStatus(result.status);
    onVoiceChange?.(result.status);
    setNote(COPY.voiceAudioSaved);
  }

  async function toggleRecord() {
    setError("");
    setNote("");
    if (recording && sessionRef.current) {
      setRecording(false);
      const stopped = await sessionRef.current.stop();
      sessionRef.current = null;
      if (!stopped.ok) {
        setError(VOICE_RECORDER_ERROR_COPY[stopped.error]);
        return;
      }
      await uploadFile(stopped.file);
      return;
    }
    const started = await startVoiceRecording();
    if (!started.ok) {
      setError(VOICE_RECORDER_ERROR_COPY[started.error as VoiceRecorderError]);
      return;
    }
    sessionRef.current = started.session;
    setRecording(true);
  }

  function playAudio() {
    if (!status?.audioUrl) return;
    onPlay(status.audioUrl);
  }

  async function clearVoice() {
    setBusy(true);
    setError("");
    setNote("");
    const result = await deleteCharacterVoice(projectId!);
    setBusy(false);
    if (!result.ok) {
      setError(VOICE_ERROR_COPY[result.error as VoiceClientError]);
      return;
    }
    setStatus(result.status);
    onVoiceChange?.(result.status);
    setMessage("");
    setRole("narrator");
  }

  return (
    <div className="studio-ws__inspector-block studio-ws__voice-card">
      <h2>{COPY.voiceHeading}</h2>
      <p className="studio-ws__muted">{COPY.voiceSupport}</p>

      <p className="studio-ws__section-label">{COPY.voiceRoleLabel}</p>
      <div className="studio-ws__mode-cards" role="group" aria-label={COPY.voiceRoleLabel}>
        {(
          [
            {
              id: "narrator" as const,
              label: COPY.voiceRoleNarrator,
              hint: COPY.voiceRoleNarratorHint
            },
            {
              id: "hidden" as const,
              label: COPY.voiceRoleHidden,
              hint: COPY.voiceRoleHiddenHint
            }
          ] as const
        ).map((option) => {
          const selected = role === option.id;
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={selected}
              className={`studio-ws__mode-card${selected ? " is-selected" : ""}`}
              disabled={busy || recording}
              onClick={() => setRole(option.id)}
            >
              <span className="studio-ws__mode-copy">
                <strong>{option.label}</strong>
                <span>{option.hint}</span>
              </span>
            </button>
          );
        })}
      </div>

      <label className="studio-ws__field" htmlFor="studio-voice-message">
        <span>{COPY.voiceMessageLabel}</span>
        <textarea
          id="studio-voice-message"
          rows={3}
          maxLength={CHARACTER_VOICE_MESSAGE_MAX}
          value={message}
          disabled={busy || recording}
          placeholder={COPY.voiceMessagePlaceholder}
          onChange={(event) => setMessage(event.target.value)}
        />
        <em>
          {remaining} {COPY.voiceMessageCount}
        </em>
      </label>

      <button
        type="button"
        className="studio-ws__primary-btn"
        disabled={busy || recording || !message.trim()}
        onClick={() => void persistVoice()}
      >
        {busy ? COPY.voiceSaving : COPY.voiceSave}
      </button>

      <p className="studio-ws__section-label">{COPY.voiceAudioLabel}</p>
      <p className="studio-ws__muted">{COPY.voiceLimits}</p>
      <div className="studio-ws__voice-actions">
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/webm,audio/ogg,.mp3,.m4a,.webm,.ogg"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void uploadFile(file);
          }}
        />
        <button
          type="button"
          className="studio-ws__btn-secondary"
          disabled={busy || recording}
          onClick={() => fileInputRef.current?.click()}
        >
          {COPY.voiceUpload}
        </button>
        {canRecord ? (
          <button
            type="button"
            className="studio-ws__btn-secondary"
            disabled={busy}
            aria-pressed={recording}
            onClick={() => void toggleRecord()}
          >
            {recording ? COPY.voiceStop : COPY.voiceRecord}
          </button>
        ) : null}
        {status?.audioUrl ? (
          <button
            type="button"
            className="studio-ws__btn-secondary"
            disabled={busy || recording}
            onClick={playAudio}
          >
            {COPY.voicePlay}
          </button>
        ) : null}
        {status?.voice ? (
          <button
            type="button"
            className="studio-ws__ghost-btn"
            disabled={busy || recording}
            onClick={() => void clearVoice()}
          >
            {COPY.voiceDelete}
          </button>
        ) : null}
      </div>

      {recording ? (
        <p className="studio-ws__muted" role="status">
          {COPY.voiceRecording}
        </p>
      ) : null}
      {note ? (
        <p className="studio-ws__muted" role="status">
          {note}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="studio-ws__inline-error">
          {error}
        </p>
      ) : null}
      <p className="studio-ws__muted">{COPY.voiceHonest}</p>
    </div>
  );
}
