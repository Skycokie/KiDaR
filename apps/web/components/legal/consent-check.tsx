"use client";

import { useStudioI18n } from "@/components/i18n/studio-i18n";
import { hrefForLocale } from "@/i18n/locale";
import { LEGAL_PATHS } from "@/lib/legal";
import type { ConsentKind } from "@/lib/consent";
import "./legal.css";

/** Checkbox for a required consent, with a link to the privacy policy at the end of the sentence. */
export function ConsentCheck({
  kind,
  checked,
  disabled,
  onChange
}: {
  kind: ConsentKind;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  const { locale, messages } = useStudioI18n();
  const copy = messages.legal;
  return (
    <label className="consent-check" data-consent={kind}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>
        {kind === "parent" ? copy.consentParent : copy.consentVoice}{" "}
        <a href={hrefForLocale(LEGAL_PATHS.privacy, locale)} target="_blank" rel="noopener noreferrer">
          {copy.consentPolicyLink}
        </a>
        .
      </span>
    </label>
  );
}
