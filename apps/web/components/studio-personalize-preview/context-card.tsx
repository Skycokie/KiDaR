"use client";

import { COPY } from "./fixtures";
import type { PersonalizeState } from "./form-state";
import {
  CONTEXT_STORY_MAX,
  CONTEXT_SUGGESTIONS,
  contextPreviewLines
} from "./scene-context";

export function ContextCard({
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
  const resultId = "studio-context-result";
  const preview =
    !locked && state.context.story
      ? contextPreviewLines(state.context, state)
      : [];

  return (
    <section
      className="studio-context"
      aria-labelledby="studio-context-heading"
      data-locked={locked ? "yes" : "no"}
    >
      <h2 id="studio-context-heading" className="studio-context__title">
        {COPY.contextHeading}
      </h2>
      <p className="studio-context__support">
        {locked ? COPY.contextNeedsDrawing : COPY.contextSupport}
      </p>
      <label className="studio-context__label" htmlFor="studio-context-story">
        {COPY.contextFieldLabel}
      </label>
      <textarea
        id="studio-context-story"
        className="studio-context__field"
        rows={4}
        maxLength={CONTEXT_STORY_MAX}
        disabled={locked}
        placeholder={COPY.contextPlaceholder}
        value={state.contextStory}
        aria-describedby={resultId}
        onChange={(event) => onChange(event.target.value)}
      />
      <p className="studio-context__suggestions-label" id="studio-context-suggestions">
        {COPY.contextSuggestions}
      </p>
      <div className="studio-context__chips" role="group" aria-labelledby="studio-context-suggestions">
        {CONTEXT_SUGGESTIONS.map((suggestion) => {
          const selected = state.contextStory === suggestion;
          return (
            <button
              key={suggestion}
              type="button"
              className={`studio-context__chip${selected ? " is-selected" : ""}`}
              aria-pressed={selected}
              disabled={locked}
              onClick={() => onChange(suggestion)}
            >
              {suggestion}
            </button>
          );
        })}
      </div>
      <div className="studio-context__actions">
        <button type="button" className="studio-ws__primary-btn" disabled={locked} onClick={onApply}>
          {COPY.contextApply}
        </button>
        <button type="button" className="studio-ws__ghost-btn" disabled={locked} onClick={onReset}>
          {COPY.contextReset}
        </button>
      </div>
      <div id={resultId} className="studio-context__result" role="status" aria-live="polite">
        {state.contextNotice ? <p>{state.contextNotice}</p> : null}
        {preview.length > 0 ? (
          <>
            <p className="studio-context__result-title">{COPY.contextPreviewTitle}</p>
            <ul>
              {preview.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
      <p className="studio-context__honest">{COPY.contextHonest}</p>
    </section>
  );
}
