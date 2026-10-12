import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StudioI18nProvider } from "@/components/i18n/studio-i18n";
import { en } from "@/i18n/messages/en";
import { ro } from "@/i18n/messages/ro";
import { CreationChat } from "./creation-chat";
import { ChatCardView, FigurineBlockedCard } from "./creation-chat-cards";
import { GenerateConfirmDialog } from "./generate-confirm-dialog";
import { nextRightPanelTab, RightPanelTabs } from "./right-panel-tabs";
import { CURRENT_GENERATION_COST } from "./generation-cost";

const read = (file: string) => readFileSync(join(__dirname, file), "utf8");

const render = (node: ReactElement, locale: "ro" | "en" = "ro") =>
  renderToStaticMarkup(createElement(StudioI18nProvider, { locale, children: node }));

const noop = () => undefined;

afterEach(() => vi.unstubAllGlobals());

describe("CreationChat without a project", () => {
  it("is visible but disabled and performs zero fetches", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const html = render(
      createElement(CreationChat, { projectId: null, hasDrawing: false, onApplySettings: noop })
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(html).toContain('data-chat-state="disabled"');
    expect(html).toContain(ro.chat.unavailableTitle);
    expect(html).toContain(ro.chat.needsProject);
    // composer and send button are disabled
    expect(html).toMatch(/<textarea[^>]*\sdisabled=""/);
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*\sdisabled=""/);
    // no starters that would imply it works
    expect(html).not.toContain(ro.chat.startersLabel);
  });

  it("is also disabled when the project id is missing entirely (sandbox shell)", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const html = render(createElement(CreationChat, { hasDrawing: true, onApplySettings: noop }));
    expect(html).toContain('data-chat-state="disabled"');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("CreationChat with a project", () => {
  const html = render(
    createElement(CreationChat, {
      projectId: "p1",
      drawingSrc: "/local/preview.png",
      hasDrawing: true,
      onApplySettings: noop
    })
  );

  it("renders an accessible conversation and composer", () => {
    expect(html).toContain('data-chat-state="ready"');
    expect(html).toContain('role="log"');
    expect(html).toContain('aria-live="polite"');
    // the log is focusable so keyboard users can scroll it
    expect(html).toMatch(/role="log"[^>]*tabindex="0"|tabindex="0"[^>]*role="log"/);
    // the textarea has a real label and a length limit
    expect(html).toMatch(/<label[^>]*for="([^"]+)"[^>]*>/);
    const forId = /<label[^>]*for="([^"]+)"/.exec(html)?.[1];
    expect(html).toContain(`id="${forId}"`);
    expect(html).toMatch(/maxLength="240"/i);
    expect(html).not.toMatch(/<textarea[^>]*\sdisabled=""/);
    // send is disabled while the draft is empty
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*\sdisabled=""/);
  });

  it("starts with the existing suggestions and honest, real-only help", () => {
    for (const suggestion of ro.prompt.suggestions.slice(0, 3)) expect(html).toContain(suggestion);
    expect(html).toContain(ro.chat.helpImproveLabel);
    expect(html).toContain(ro.chat.helpStylesLabel);
    // chips are real buttons
    expect(html).toMatch(/<button[^>]*class="studio-chat__chip"/);
  });

  it("shows the drawing only as a local thumbnail and says it is never sent", () => {
    expect(html).toContain('src="/local/preview.png"');
    expect(html).toContain(ro.chat.drawingRef);
    expect(html).toContain(ro.chat.textOnly);
    expect(html).toContain(ro.chat.historyNote);
  });

  it("does not claim a quota before the API reported one", () => {
    expect(html).not.toContain(ro.chat.remaining);
  });

  it("shows the 3D figure card as disabled with the required explanation", () => {
    expect(html).toContain(ro.chat.figurineCardBlocked);
    expect(html).toContain("Generarea este indisponibilă momentan; costul nu poate fi verificat.");
    expect(html).toMatch(/<button[^>]*\sdisabled=""[^>]*>[^<]*Generează figurină 3D/);
  });

  it("never promises free or priced generation", () => {
    const text = html.toLowerCase();
    expect(text).not.toMatch(/gratuit|free\b|credit(e)? incluse|€|\$|lei\b|ron\b/);
  });
});

describe("chat cards", () => {
  it("the 3D figure card has no way to start a job", () => {
    const markup = render(createElement(FigurineBlockedCard));
    expect(markup).toContain(ro.chat.figurineCardBlocked);
    expect(markup).toMatch(/<button[^>]*\sdisabled=""/);
    expect(read("creation-chat-cards.tsx")).not.toMatch(/startFigurineGeneration|generate-figurine|fetch\s*\(/);
  });

  it("improved prompts are text suggestions that start nothing", () => {
    const markup = render(
      createElement(ChatCardView, {
        card: { kind: "improved_prompt", text: "Un dragon prietenos" },
        applied: false,
        canApply: true,
        onApply: noop,
        onUseText: noop
      })
    );
    expect(markup).toContain("Un dragon prietenos");
    expect(markup).toContain(ro.chat.suggestionOnly);
    expect(markup).toContain(ro.chat.useInMessage);
  });

  it("settings cards need a drawing to be applied", () => {
    const card = {
      kind: "settings" as const,
      settings: { motion: "float" as const, decor: null, palette: null, lighting: null }
    };
    const without = render(
      createElement(ChatCardView, { card, applied: false, canApply: false, onApply: noop, onUseText: noop })
    );
    expect(without).toMatch(/<button[^>]*\sdisabled=""/);
    expect(without).toContain(ro.prompt.needsDrawing);
    const withDrawing = render(
      createElement(ChatCardView, { card, applied: false, canApply: true, onApply: noop, onUseText: noop })
    );
    expect(withDrawing).not.toMatch(/<button[^>]*\sdisabled=""/);
    const applied = render(
      createElement(ChatCardView, { card, applied: true, canApply: true, onApply: noop, onUseText: noop })
    );
    expect(applied).toContain(ro.chat.settingsApplied);
  });
});

describe("generation confirmation (existing button)", () => {
  it("cannot be confirmed while the cost is unverifiable", () => {
    const html = render(
      createElement(GenerateConfirmDialog, {
        cost: CURRENT_GENERATION_COST,
        drawingSrc: "/local/preview.png",
        onCancel: noop,
        onConfirm: noop
      })
    );
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain(ro.chat.generateDialog.imageUsed);
    expect(html).toContain(ro.chat.generateDialog.operation);
    expect(html).toContain(ro.chat.generateDialog.costUnverified);
    expect(html).toMatch(/<button[^>]*\sdisabled=""[^>]*>Confirmă generarea<\/button>/);
    // the cancel button stays usable
    expect(html).toMatch(/<button(?![^>]*disabled)[^>]*>Închide<\/button>/);
    expect(html.toLowerCase()).not.toMatch(/gratuit|free\b|€|\$|lei\b/);
  });

  it("the card only starts a job from the dialog's confirm handler", () => {
    const card = read("figurine-generate-card.tsx");
    expect(card).toMatch(/setConfirmOpen\(true\)/);
    // exactly one call site for the start helper, inside startGeneration
    expect(card.match(/startFigurineGeneration\(/g)).toHaveLength(1);
    expect(card).toMatch(/const startGeneration = async/);
    expect(card).toMatch(/onConfirm=\{\(\) => \{[^}]*startGeneration\(\)/s);
    expect(card).toMatch(/GenerateConfirmDialog/);
  });
});

describe("right panel tabs", () => {
  const html = render(
    createElement(RightPanelTabs, {
      tab: "assistant",
      onTab: noop,
      settings: createElement("div", { id: "settings-content" }, "S"),
      assistant: createElement("div", { id: "assistant-content" }, "A")
    })
  );

  it("is a proper tablist with a roving tabindex", () => {
    expect(html).toContain('role="tablist"');
    expect(html.match(/role="tab"/g)).toHaveLength(2);
    expect(html).toMatch(/aria-selected="true"[^>]*tabindex="0"|tabindex="0"[^>]*aria-selected="true"/);
    expect(html).toMatch(/aria-selected="false"[^>]*tabindex="-1"|tabindex="-1"[^>]*aria-selected="false"/);
    expect(html.match(/role="tabpanel"/g)).toHaveLength(2);
  });

  it("keeps both panels mounted and hides only the inactive one", () => {
    expect(html).toContain("assistant-content");
    expect(html).toContain("settings-content");
    expect(html.match(/hidden=""/g)).toHaveLength(1);
  });

  it("navigates with the keyboard", () => {
    expect(nextRightPanelTab("settings", "ArrowRight")).toBe("assistant");
    expect(nextRightPanelTab("assistant", "ArrowRight")).toBe("settings");
    expect(nextRightPanelTab("settings", "ArrowLeft")).toBe("assistant");
    expect(nextRightPanelTab("assistant", "Home")).toBe("settings");
    expect(nextRightPanelTab("settings", "End")).toBe("assistant");
    expect(nextRightPanelTab("settings", "x")).toBeNull();
  });
});

describe("shell integration and desktop layout", () => {
  const shell = read("personalize-shell.tsx");
  const chatCss = read("creation-chat.css");
  const baseCss = read("personalize-preview.css");

  it("mounts the chat in the existing right column tab, not as a new layout", () => {
    expect(shell).toContain("<RightPanelTabs");
    expect(shell).toContain("<CreationChat");
    expect(shell).toContain("projectId={projectId}");
    expect(shell).not.toMatch(/IdeaPromptCard/);
    // the desktop grid is untouched: rail | stage | right column
    expect(baseCss).toContain("clamp(300px, 22vw, 380px)");
    expect(shell).not.toMatch(/\bfetch\s*\(/);
  });

  it("has a visible keyboard focus on every new interactive element", () => {
    for (const selector of [
      ".studio-ws__tab:focus-visible",
      ".studio-chat__chip:focus-visible",
      ".studio-chat__field:focus-visible"
    ]) {
      expect(chatCss).toContain(selector);
    }
    expect(chatCss).toMatch(/\.studio-chat__field:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--focus\)/);
    // the shared studio focus ring still applies to the rest
    expect(baseCss).toMatch(/\.studio-ws :focus-visible\s*\{[^}]*outline:\s*2px solid var\(--focus\)/);
  });

  it("gives disabled controls an obvious state", () => {
    expect(chatCss).toMatch(/\.studio-chat__field:disabled\s*\{[^}]*opacity/);
    expect(chatCss).toMatch(/\.studio-ws__btn-primary:disabled\s*\{[^}]*cursor:\s*not-allowed/);
  });

  it("keeps hidden tab panels hidden at every width and lets the chat fill the desktop column", () => {
    expect(chatCss).toMatch(/\.studio-ws__tabpanel\[hidden\]\s*\{\s*display:\s*none/);
    expect(chatCss).toMatch(/@media \(min-width: 900px\)\s*\{[^@]*\.studio-ws__tabpanel\s*\{[^}]*display:\s*flex/);
    expect(chatCss).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
  });

  it("keeps the new UI strings in the message catalogs (both locales, no hardcoded copy)", () => {
    for (const key of Object.keys(ro.chat) as Array<keyof typeof ro.chat>) {
      expect(en.chat[key], `en.chat.${key}`).toBeTruthy();
    }
    expect(ro.chat.figurineCardBlocked).toBe(
      "Generarea este indisponibilă momentan; costul nu poate fi verificat."
    );
    expect(en.chat.figurineCardBlocked).toBe("Generation is unavailable right now; the cost cannot be verified.");
  });
});
