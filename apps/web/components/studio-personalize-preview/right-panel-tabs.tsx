"use client";

import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { useStudioI18n } from "@/components/i18n/studio-i18n";

export type RightPanelTab = "settings" | "assistant";

const ORDER: readonly RightPanelTab[] = ["settings", "assistant"];

/** Next tab for a roving-tabindex tablist. Null when the key is not a navigation key. */
export function nextRightPanelTab(current: RightPanelTab, key: string): RightPanelTab | null {
  const index = ORDER.indexOf(current);
  if (key === "ArrowRight" || key === "ArrowDown") return ORDER[(index + 1) % ORDER.length];
  if (key === "ArrowLeft" || key === "ArrowUp") return ORDER[(index - 1 + ORDER.length) % ORDER.length];
  if (key === "Home") return ORDER[0];
  if (key === "End") return ORDER[ORDER.length - 1];
  return null;
}

/**
 * Settings | Assistant tabs for the right column. Both panels stay mounted (the inactive one
 * is hidden) so Studio inspector state and the in-memory chat survive tab switches.
 */
export function RightPanelTabs({
  tab,
  onTab,
  settings,
  assistant
}: {
  tab: RightPanelTab;
  onTab: (tab: RightPanelTab) => void;
  settings: ReactNode;
  assistant: ReactNode;
}) {
  const { messages } = useStudioI18n();
  const chat = messages.chat;
  const base = useId();
  const refs = useRef<Record<RightPanelTab, HTMLButtonElement | null>>({ settings: null, assistant: null });
  const ids = (id: RightPanelTab) => ({ tab: `${base}-tab-${id}`, panel: `${base}-panel-${id}` });
  const labels: Record<RightPanelTab, string> = {
    settings: chat.tabSettings,
    assistant: chat.tabAssistant
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, current: RightPanelTab) => {
    const next = nextRightPanelTab(current, event.key);
    if (!next) return;
    event.preventDefault();
    onTab(next);
    refs.current[next]?.focus();
  };

  return (
    <>
      <div className="studio-ws__tabs" role="tablist" aria-label={chat.tabsLabel}>
        {ORDER.map((id) => (
          <button
            key={id}
            ref={(node) => {
              refs.current[id] = node;
            }}
            type="button"
            role="tab"
            id={ids(id).tab}
            aria-selected={tab === id}
            aria-controls={ids(id).panel}
            tabIndex={tab === id ? 0 : -1}
            className={`studio-ws__tab${tab === id ? " is-active" : ""}`}
            onClick={() => onTab(id)}
            onKeyDown={(event) => onKeyDown(event, id)}
          >
            {labels[id]}
          </button>
        ))}
      </div>
      {ORDER.map((id) => (
        <div
          key={id}
          role="tabpanel"
          id={ids(id).panel}
          aria-labelledby={ids(id).tab}
          className="studio-ws__tabpanel"
          hidden={tab !== id}
        >
          {id === "settings" ? settings : assistant}
        </div>
      ))}
    </>
  );
}
