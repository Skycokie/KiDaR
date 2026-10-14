"use client";

import { useState } from "react";
import { useStudioI18n } from "@/components/i18n/studio-i18n";
import type { AnimationId, DecorId, LightingId, PaletteId } from "./fixtures";
import type { PersonalizeState } from "./form-state";
import { recordAiConsent, requestStudioAssistant } from "./assistant-client";

/** Compact idea chat — local keywords always work; AI when flag + consent allow. */
export function IdeaPromptCard({
  state,
  locked,
  projectId = null,
  onChange,
  onApplyLocal,
  onApplyAssistant,
  onReset,
  onSuggest3d
}: {
  state: PersonalizeState;
  locked: boolean;
  projectId?: string | null;
  onChange: (value: string) => void;
  onApplyLocal: () => void;
  onApplyAssistant: (input: {
    prompt: string;
    reply: string;
    motion: AnimationId | null;
    decor: DecorId | null;
    palette: PaletteId | null;
    lighting: LightingId | null;
  }) => void;
  onReset: () => void;
  onSuggest3d?: () => void;
}) {
  const resultId = "studio-idea-result";
  const { locale, messages } = useStudioI18n();
  const prompt = messages.prompt;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsAiConsent, setNeedsAiConsent] = useState(false);
  const [aiConsentChecked, setAiConsentChecked] = useState(false);
  const [suggest3d, setSuggest3d] = useState(false);

  const errorText = (code: string) => {
    const map = prompt.errors as Record<string, string>;
    return map[code] ?? prompt.errors.generic;
  };

  const apply = async () => {
    setError(null);
    setSuggest3d(false);
    if (!projectId) {
      onApplyLocal();
      return;
    }
    setBusy(true);
    const result = await requestStudioAssistant(projectId, state.ideaPrompt, locale === "en" ? "en" : "ro");
    setBusy(false);

    if (!result.ok) {
      if (result.error === "flag_off") {
        onApplyLocal();
        return;
      }
      if (result.error === "consent_ai") {
        setNeedsAiConsent(true);
        setError(errorText("consent_ai"));
        return;
      }
      setError(errorText(result.error));
      if (result.error === "network" || result.error === "store" || result.error === "generic") {
        onApplyLocal();
      }
      return;
    }

    if (result.source === "blocked") {
      setError(errorText("blocked"));
      return;
    }

    onApplyAssistant({
      prompt: state.ideaPrompt,
      reply: result.reply,
      motion: result.settings.motion as AnimationId | null,
      decor: result.settings.decor as DecorId | null,
      palette: result.settings.palette as PaletteId | null,
      lighting: result.settings.lighting as LightingId | null
    });
    if (result.intent === "suggest_3d") {
      setSuggest3d(true);
      onSuggest3d?.();
    }
  };

  const acceptAiConsent = async () => {
    if (!aiConsentChecked) return;
    setBusy(true);
    const ok = await recordAiConsent();
    setBusy(false);
    if (!ok) {
      setError(errorText("consent_save"));
      return;
    }
    setNeedsAiConsent(false);
    setError(null);
    await apply();
  };

  return (
    <section className="studio-idea" aria-labelledby="studio-idea-heading" data-locked={locked ? "yes" : "no"}>
      <label className="studio-idea__kicker" htmlFor="studio-idea-prompt" id="studio-idea-heading">
        {prompt.label}
      </label>
      <p className="studio-ws__muted studio-idea__privacy">{prompt.privacyHint}</p>
      <div className="studio-idea__chat">
        <textarea
          id="studio-idea-prompt"
          className="studio-idea__field"
          rows={2}
          maxLength={240}
          disabled={locked || busy}
          placeholder={locked ? prompt.needsDrawing : prompt.placeholder}
          value={state.ideaPrompt}
          aria-describedby={resultId}
          onChange={(event) => onChange(event.target.value)}
        />
        <div className="studio-idea__actions">
          <button
            type="button"
            className="studio-ws__primary-btn"
            disabled={locked || busy}
            onClick={() => void apply()}
          >
            {busy ? prompt.thinking : prompt.apply}
          </button>
          <button type="button" className="studio-ws__ghost-btn" disabled={locked || busy} onClick={onReset}>
            {prompt.reset}
          </button>
        </div>
      </div>

      {needsAiConsent ? (
        <div className="studio-idea__consent">
          <label className="studio-idea__consent-label">
            <input
              type="checkbox"
              checked={aiConsentChecked}
              onChange={(event) => setAiConsentChecked(event.target.checked)}
            />
            <span>{prompt.consentLabel}</span>
          </label>
          <button
            type="button"
            className="studio-ws__primary-btn"
            disabled={!aiConsentChecked || busy}
            onClick={() => void acceptAiConsent()}
          >
            {prompt.consentAccept}
          </button>
        </div>
      ) : null}

      {suggest3d ? (
        <p className="studio-idea__suggest3d" role="status">
          {prompt.suggest3d}
        </p>
      ) : null}

      <div id={resultId} className="studio-idea__result" role="status" aria-live="polite">
        {state.ideaNotice ? <p>{state.ideaNotice}</p> : null}
        {state.ideaResult?.recognized ? (
          <>
            <p className="studio-idea__result-title">{prompt.resultTitle}</p>
            <ul>
              {state.ideaResult.lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </>
        ) : null}
        {state.ideaResult && !state.ideaResult.recognized ? <p>{prompt.fallback}</p> : null}
      </div>
      {error ? (
        <p className="studio-ws__error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
