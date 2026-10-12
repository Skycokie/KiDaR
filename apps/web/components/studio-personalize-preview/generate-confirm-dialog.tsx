"use client";

import { useEffect, useId, useRef, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { useStudioI18n } from "@/components/i18n/studio-i18n";
import { canConfirmGeneration, type GenerationCost } from "./generation-cost";

/**
 * Confirmation before any 3D generation job. It states which image is used and what happens,
 * and it can only be confirmed when the cost is verified from a real source. With the current
 * unverifiable cost the confirm button is disabled and nothing is ever sent.
 */
export function GenerateConfirmDialog({
  cost,
  drawingSrc = null,
  onCancel,
  onConfirm
}: {
  cost: GenerationCost;
  drawingSrc?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { messages } = useStudioI18n();
  const dialog = messages.chat.generateDialog;
  const titleId = useId();
  const descId = useId();
  const costId = useId();
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const confirmable = canConfirmGeneration(cost);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    return () => previous?.focus?.();
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      onCancel();
      return;
    }
    if (event.key !== "Tab") return;
    // Keep focus inside the dialog (only enabled buttons are focusable).
    const focusable = Array.from(
      panelRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled)") ?? []
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const content = (
    <div className="studio-ws__publish-scrim" onClick={onCancel}>
      <div
        ref={panelRef}
        className="studio-ws__publish-dialog studio-confirm"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={`${descId} ${costId}`}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <h2 id={titleId} className="studio-ws__publish-title">
          {dialog.title}
        </h2>
        {drawingSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={drawingSrc} alt="" className="studio-confirm__thumb" />
        ) : null}
        <p id={descId}>
          {dialog.imageUsed} {dialog.operation}
        </p>
        <p id={costId} className="studio-confirm__cost" role="note">
          {cost.status === "verified" ? cost.summary : dialog.costUnverified}
        </p>
        <div className="studio-ws__publish-actions">
          <button ref={cancelRef} type="button" className="studio-ws__btn-secondary" onClick={onCancel}>
            {dialog.cancel}
          </button>
          <button
            type="button"
            className="studio-ws__btn-primary"
            disabled={!confirmable}
            aria-describedby={costId}
            onClick={() => {
              if (confirmable) onConfirm();
            }}
          >
            {dialog.confirm}
          </button>
        </div>
      </div>
    </div>
  );

  // Render inside the Studio root: the right column is a transformed sheet on small screens,
  // which would otherwise trap a fixed-position dialog.
  const host = typeof document === "undefined" ? null : document.querySelector(".studio-ws");
  return host ? createPortal(content, host) : content;
}
