import { useStudioI18n } from "@/components/i18n/studio-i18n";
import type { PersonalizeState } from "./form-state";

/** Compact AI chat only — no suggestion chips, so Personaj fits without scroll. */
export function IdeaPromptCard({
  state,
  locked,
  onChange,
  onApply,
  onReset
}: {
  state: PersonalizeState;
  locked: boolean;
  onChange: (value: string) => void;
  onApply: () => void;
  onReset: () => void;
}) {
  const resultId = "studio-idea-result";
  const { messages } = useStudioI18n();
  const prompt = messages.prompt;
  return (
    <section className="studio-idea" aria-labelledby="studio-idea-heading" data-locked={locked ? "yes" : "no"}>
      <label className="studio-idea__kicker" htmlFor="studio-idea-prompt" id="studio-idea-heading">
        {prompt.label}
      </label>
      <div className="studio-idea__chat">
        <textarea
          id="studio-idea-prompt"
          className="studio-idea__field"
          rows={2}
          maxLength={240}
          disabled={locked}
          placeholder={locked ? prompt.needsDrawing : prompt.placeholder}
          value={state.ideaPrompt}
          aria-describedby={resultId}
          onChange={(event) => onChange(event.target.value)}
        />
        <div className="studio-idea__actions">
          <button type="button" className="studio-ws__primary-btn" disabled={locked} onClick={onApply}>
            {prompt.apply}
          </button>
          <button type="button" className="studio-ws__ghost-btn" disabled={locked} onClick={onReset}>
            {prompt.reset}
          </button>
        </div>
      </div>
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
    </section>
  );
}
