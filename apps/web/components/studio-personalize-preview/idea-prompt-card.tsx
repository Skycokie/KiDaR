import { useStudioI18n } from "@/components/i18n/studio-i18n";
import { COPY } from "./fixtures";
import type { PersonalizeState } from "./form-state";

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
      <label className="studio-idea__kicker" htmlFor="studio-idea-prompt">
        {prompt.label}
      </label>
      <h3 id="studio-idea-heading" className="studio-idea__title">
        {prompt.heading}
      </h3>
      <p className="studio-idea__support">{locked ? COPY.ideaNeedsDrawing : prompt.description}</p>
      <textarea
        id="studio-idea-prompt"
        className="studio-idea__field"
        rows={3}
        maxLength={240}
        disabled={locked}
        placeholder={prompt.placeholder}
        value={state.ideaPrompt}
        aria-describedby={resultId}
        onChange={(event) => onChange(event.target.value)}
      />
      <p className="studio-idea__suggestions-label" id="studio-idea-suggestions">
        {COPY.ideaSuggestions}
      </p>
      <div className="studio-idea__chips" role="group" aria-labelledby="studio-idea-suggestions">
        {prompt.suggestions.map((suggestion) => {
          const selected = state.ideaPrompt === suggestion;
          return (
            <button
              key={suggestion}
              type="button"
              className={`studio-idea__chip${selected ? " is-selected" : ""}`}
              aria-pressed={selected}
              disabled={locked}
              onClick={() => onChange(suggestion)}
            >
              {suggestion}
            </button>
          );
        })}
      </div>
      <div className="studio-idea__actions">
        <button type="button" className="studio-ws__primary-btn" disabled={locked} onClick={onApply}>
          {prompt.apply}
        </button>
        <button type="button" className="studio-ws__ghost-btn" disabled={locked} onClick={onReset}>
          {prompt.reset}
        </button>
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
      <p className="studio-idea__honest">{COPY.ideaHonest}</p>
    </section>
  );
}
