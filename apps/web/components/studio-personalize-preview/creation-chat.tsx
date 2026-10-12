"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useStudioI18n } from "@/components/i18n/studio-i18n";
import {
  recordAiConsent,
  remainingMessages,
  requestStudioAssistant,
  type AssistantClientError,
  type AssistantClientUsage
} from "./assistant-client";
import { ChatCardView, FigurineBlockedCard } from "./creation-chat-cards";
import {
  CHAT_PROMPT_MAX,
  chatAvailability,
  isSendKey,
  isTerminalChatError,
  runChatTurn,
  validateChatInput,
  type ChatMessage,
  type ChatSettings
} from "./creation-chat-state";

/**
 * AI creation chat. Text only: the drawing is shown as a local thumbnail for reference and is
 * never sent anywhere. The conversation lives in this component's memory (gone on refresh).
 * Without a project it renders disabled and performs no request.
 */
export function CreationChat({
  projectId = null,
  drawingSrc = null,
  hasDrawing,
  onApplySettings
}: {
  projectId?: string | null;
  drawingSrc?: string | null;
  hasDrawing: boolean;
  onApplySettings: (input: { prompt: string; reply: string; settings: ChatSettings }) => void;
}) {
  const { locale, messages } = useStudioI18n();
  const chat = messages.chat;
  const promptCopy = messages.prompt;
  const available = chatAvailability(projectId) === "ready";

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [usage, setUsage] = useState<AssistantClientUsage | null>(null);
  const [error, setError] = useState<AssistantClientError | null>(null);
  const [terminal, setTerminal] = useState(false);
  const [needsConsent, setNeedsConsent] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const [applied, setApplied] = useState<ReadonlySet<string>>(() => new Set());
  const counter = useRef(0);
  const logRef = useRef<HTMLDivElement | null>(null);
  const fieldRef = useRef<HTMLTextAreaElement | null>(null);
  const fieldId = useId();
  const errorId = useId();

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [chatMessages, busy]);

  const errorText = (code: AssistantClientError) => {
    const map = promptCopy.errors as Record<string, string>;
    return map[code] ?? promptCopy.errors.generic;
  };

  const nextId = () => {
    counter.current += 1;
    return `chat-${counter.current}`;
  };

  const send = async (raw: string, previous: readonly ChatMessage[] = chatMessages) => {
    const text = raw.trim();
    if (busy) return;
    const validity = validateChatInput(text);
    if (validity !== "ok") {
      setError(validity);
      return;
    }
    setError(null);
    const userMessage: ChatMessage = { id: nextId(), role: "user", text, cards: [] };
    setChatMessages([...previous, userMessage]);
    setDraft("");
    setBusy(true);

    const outcome = await runChatTurn({
      projectId,
      text,
      locale: locale === "en" ? "en" : "ro",
      messages: previous,
      request: requestStudioAssistant
    });
    setBusy(false);

    const mark = (status: "failed" | "blocked", code?: AssistantClientError) =>
      setChatMessages((current) =>
        current.map((message) =>
          message.id === userMessage.id ? { ...message, status, error: code } : message
        )
      );

    if (outcome.kind === "ok") {
      if (outcome.usage) setUsage(outcome.usage);
      setChatMessages((current) => [
        ...current,
        { id: nextId(), role: "assistant", text: outcome.reply, cards: outcome.cards }
      ]);
      return;
    }
    if (outcome.kind === "blocked") {
      if (outcome.usage) setUsage(outcome.usage);
      mark("blocked");
      return;
    }
    if (outcome.kind === "unavailable") {
      mark("failed", "flag_off");
      setTerminal(true);
      return;
    }
    if (outcome.kind === "invalid") {
      mark("failed", outcome.reason === "empty" ? "empty" : "too_long");
      return;
    }
    // error
    mark("failed", outcome.error);
    if (outcome.error === "consent_ai") {
      setNeedsConsent(true);
    } else if (isTerminalChatError(outcome.error)) {
      setTerminal(true);
      setError(outcome.error);
    }
    // Other failures are shown on the failed message itself, next to its retry button.
  };

  const retry = (message: ChatMessage) => {
    const rest = chatMessages.filter((item) => item.id !== message.id);
    setChatMessages(rest);
    void send(message.text, rest);
  };

  const acceptConsent = async () => {
    if (!consentChecked || busy) return;
    setBusy(true);
    const ok = await recordAiConsent();
    setBusy(false);
    if (!ok) {
      setError("generic");
      return;
    }
    setNeedsConsent(false);
    setError(null);
    const failed = [...chatMessages].reverse().find((item) => item.status === "failed");
    if (failed) retry(failed);
  };

  const useText = (text: string) => {
    setDraft(text.slice(0, CHAT_PROMPT_MAX));
    fieldRef.current?.focus();
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void send(draft);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (isSendKey({ key: event.key, shiftKey: event.shiftKey, isComposing: event.nativeEvent.isComposing })) {
      event.preventDefault();
      void send(draft);
    }
  };

  const remaining = remainingMessages(usage);
  const composerOff = !available || terminal || busy;
  const canSend = !composerOff && draft.trim().length > 0 && !needsConsent;
  const showStarters = available && !terminal && chatMessages.length === 0;

  const starters: Array<{ label: string; text: string }> = [
    ...promptCopy.suggestions.slice(0, 3).map((text) => ({ label: text, text })),
    { label: chat.helpImproveLabel, text: chat.helpImproveText },
    { label: chat.helpStylesLabel, text: chat.helpStylesText }
  ];

  const lastUserBefore = (index: number): string => {
    for (let i = index - 1; i >= 0; i -= 1) {
      if (chatMessages[i].role === "user") return chatMessages[i].text;
    }
    return "";
  };

  return (
    <section className="studio-chat" aria-labelledby="studio-chat-title" data-chat-state={available ? "ready" : "disabled"}>
      <h2 id="studio-chat-title" className="studio-chat__title">
        {chat.title}
      </h2>

      {drawingSrc ? (
        <figure className="studio-chat__ref">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={drawingSrc} alt={chat.drawingAlt} className="studio-chat__ref-img" />
          <figcaption>{chat.drawingRef}</figcaption>
        </figure>
      ) : null}

      <div
        ref={logRef}
        className="studio-chat__log"
        role="log"
        aria-live="polite"
        aria-label={chat.messagesLabel}
        tabIndex={0}
      >
        {!available ? (
          <div className="studio-chat__empty" role="status">
            <strong>{chat.unavailableTitle}</strong>
            <p>{chat.needsProject}</p>
          </div>
        ) : null}

        {available && terminal ? (
          <div className="studio-chat__empty" role="status">
            <strong>{chat.unavailableTitle}</strong>
            <p>{error ? errorText(error) : chat.flagOff}</p>
          </div>
        ) : null}

        {showStarters ? (
          <div className="studio-chat__empty">
            <p>{chat.intro}</p>
            <p className="studio-chat__starters-label">{chat.startersLabel}</p>
            <ul className="studio-chat__starters">
              {starters.map((starter) => (
                <li key={starter.label}>
                  <button type="button" className="studio-chat__chip" onClick={() => useText(starter.text)}>
                    {starter.label}
                  </button>
                </li>
              ))}
            </ul>
            <FigurineBlockedCard />
          </div>
        ) : null}

        {chatMessages.map((message, index) => (
          <article
            key={message.id}
            className={`studio-chat__msg studio-chat__msg--${message.role}`}
            data-status={message.status ?? "ok"}
          >
            <p className="studio-chat__who">{message.role === "user" ? chat.youLabel : chat.assistantLabel}</p>
            {message.text ? <p className="studio-chat__text">{message.text}</p> : null}
            {message.status === "blocked" ? (
              <p className="studio-ws__error" role="alert">
                {chat.blockedMessage}
              </p>
            ) : null}
            {message.status === "failed" ? (
              <div className="studio-chat__failed">
                {message.error ? <p className="studio-ws__error">{errorText(message.error)}</p> : null}
                {!terminal && !needsConsent ? (
                  <button
                    type="button"
                    className="studio-ws__ghost-btn studio-chat__retry"
                    disabled={busy}
                    onClick={() => retry(message)}
                  >
                    {chat.retry}
                  </button>
                ) : null}
              </div>
            ) : null}
            {message.cards.map((card, cardIndex) => {
              const key = `${message.id}:${card.kind}:${cardIndex}`;
              return (
                <ChatCardView
                  key={key}
                  card={card}
                  applied={applied.has(key)}
                  canApply={hasDrawing}
                  onApply={(settings) => {
                    onApplySettings({
                      prompt: lastUserBefore(index),
                      reply: message.text,
                      settings
                    });
                    setApplied((current) => new Set(current).add(key));
                  }}
                  onUseText={useText}
                />
              );
            })}
          </article>
        ))}

        {busy ? (
          <p className="studio-chat__thinking" role="status">
            {chat.sending}
          </p>
        ) : null}
      </div>

      {needsConsent ? (
        <div className="studio-idea__consent">
          <label className="studio-idea__consent-label">
            <input
              type="checkbox"
              checked={consentChecked}
              onChange={(event) => setConsentChecked(event.target.checked)}
            />
            <span>{promptCopy.consentLabel}</span>
          </label>
          <button
            type="button"
            className="studio-ws__primary-btn"
            disabled={!consentChecked || busy}
            onClick={() => void acceptConsent()}
          >
            {promptCopy.consentAccept}
          </button>
        </div>
      ) : null}

      {error && !terminal ? (
        <p id={errorId} className="studio-ws__error studio-chat__error" role="alert">
          {errorText(error)}
        </p>
      ) : null}

      <form className="studio-chat__composer" onSubmit={onSubmit}>
        <label className="studio-chat__sr" htmlFor={fieldId}>
          {chat.composerLabel}
        </label>
        <textarea
          id={fieldId}
          ref={fieldRef}
          className="studio-chat__field"
          rows={2}
          maxLength={CHAT_PROMPT_MAX}
          disabled={composerOff}
          placeholder={available ? chat.composerPlaceholder : chat.needsProject}
          value={draft}
          aria-describedby={error && !terminal ? errorId : undefined}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
        />
        <div className="studio-chat__composer-row">
          <span className="studio-chat__count" aria-hidden="true">
            {draft.length}/{CHAT_PROMPT_MAX}
          </span>
          <button type="submit" className="studio-ws__primary-btn studio-chat__send" disabled={!canSend}>
            {chat.send}
          </button>
        </div>
      </form>

      {remaining !== null ? (
        <p className="studio-chat__quota" role="status">
          {chat.remaining} {remaining}
        </p>
      ) : null}
      <p className="studio-chat__fine">{chat.textOnly}</p>
      <p className="studio-chat__fine">{promptCopy.privacyHint}</p>
      <p className="studio-chat__fine">{chat.historyNote}</p>
    </section>
  );
}
