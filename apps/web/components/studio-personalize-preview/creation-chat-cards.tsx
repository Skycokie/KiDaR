"use client";

import { useId } from "react";
import { useStudioI18n } from "@/components/i18n/studio-i18n";
import type { Messages } from "@/i18n/types";
import type { ChatCard, ChatSettings } from "./creation-chat-state";

/** Human-readable lines for the preview settings a card would apply. */
export function settingsLines(settings: ChatSettings, messages: Messages): string[] {
  const COPY = messages.personalize;
  const lines: string[] = [];
  if (settings.motion) {
    lines.push(`${messages.studio.steps.motion}: ${COPY.choices.animations[settings.motion].label}`);
  }
  if (settings.decor) {
    lines.push(`${messages.studio.steps.decor}: ${COPY.choices.decor[settings.decor].label}`);
  }
  if (settings.palette) {
    lines.push(`${COPY.paletteSection}: ${COPY.choices.palettes[settings.palette].label}`);
  }
  if (settings.lighting) {
    lines.push(`${COPY.lightingSection}: ${COPY.choices.lightings[settings.lighting].label}`);
  }
  return lines;
}

/**
 * The 3D figure step as seen from the chat: always disabled while the cost cannot be
 * verified. It has no click handler on purpose; the chat never starts a generation.
 */
export function FigurineBlockedCard() {
  const { messages } = useStudioI18n();
  const chat = messages.chat;
  const reasonId = useId();
  return (
    <section className="studio-chat__card studio-chat__card--blocked" aria-label={chat.figurineCardTitle}>
      <h3 className="studio-chat__card-title">{chat.figurineCardTitle}</h3>
      <p id={reasonId} className="studio-chat__card-note">
        {chat.figurineCardBlocked}
      </p>
      <button
        type="button"
        className="studio-ws__ghost-btn studio-chat__card-btn"
        disabled
        aria-describedby={reasonId}
      >
        {messages.personalize.figurineGenerate}
      </button>
    </section>
  );
}

export function ChatCardView({
  card,
  applied,
  canApply,
  onApply,
  onUseText
}: {
  card: ChatCard;
  applied: boolean;
  /** False while there is no drawing to preview on. */
  canApply: boolean;
  onApply: (settings: ChatSettings) => void;
  onUseText: (text: string) => void;
}) {
  const { messages } = useStudioI18n();
  const chat = messages.chat;

  if (card.kind === "figurine") return <FigurineBlockedCard />;

  if (card.kind === "settings") {
    const lines = settingsLines(card.settings, messages);
    return (
      <section className="studio-chat__card" aria-label={chat.settingsCardTitle}>
        <h3 className="studio-chat__card-title">{chat.settingsCardTitle}</h3>
        <ul className="studio-chat__card-list">
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        {!canApply ? <p className="studio-chat__card-note">{messages.prompt.needsDrawing}</p> : null}
        <button
          type="button"
          className="studio-ws__primary-btn studio-chat__card-btn"
          disabled={applied || !canApply}
          onClick={() => onApply(card.settings)}
        >
          {applied ? chat.settingsApplied : messages.prompt.apply}
        </button>
      </section>
    );
  }

  if (card.kind === "improved_prompt") {
    return (
      <section className="studio-chat__card" aria-label={chat.improvedCardTitle}>
        <h3 className="studio-chat__card-title">{chat.improvedCardTitle}</h3>
        <p className="studio-chat__card-quote">{card.text}</p>
        <p className="studio-chat__card-note">{chat.suggestionOnly}</p>
        <button
          type="button"
          className="studio-ws__ghost-btn studio-chat__card-btn"
          onClick={() => onUseText(card.text)}
        >
          {chat.useInMessage}
        </button>
      </section>
    );
  }

  return (
    <section className="studio-chat__card" aria-label={chat.stylesCardTitle}>
      <h3 className="studio-chat__card-title">{chat.stylesCardTitle}</h3>
      <ul className="studio-chat__card-options">
        {card.options.map((option) => (
          <li key={option}>
            <span>{option}</span>
            <button
              type="button"
              className="studio-ws__ghost-btn studio-chat__card-btn"
              onClick={() => onUseText(option)}
            >
              {chat.useInMessage}
            </button>
          </li>
        ))}
      </ul>
      <p className="studio-chat__card-note">{chat.suggestionOnly}</p>
    </section>
  );
}
