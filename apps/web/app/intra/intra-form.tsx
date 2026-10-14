"use client";

import Link from "next/link";
import { FormEvent, useId, useRef, useState } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import type { Locale } from "@/i18n/config";
import { hrefForLocale } from "@/i18n/locale";
import type { Messages } from "@/i18n/types";

export function IntraForm({ locale, messages }: { locale: Locale; messages: Messages }) {
  const emailId = useId();
  const errorId = useId();
  const emailRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [devLoginUrl, setDevLoginUrl] = useState("");
  const auth = messages.auth;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || !emailRef.current?.checkValidity()) {
      setError(auth.invalidEmail);
      emailRef.current?.focus();
      return;
    }
    setLoading(true);
    setError("");
    setSent(false);
    setDevLoginUrl("");
    try {
      const response = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: trimmed, next: "/creaza" })
      });
      const payload = (await response.json()) as { devLoginUrl?: string };
      if (!response.ok) {
        setError(auth.sendMailError);
        emailRef.current?.focus();
        return;
      }
      setSent(true);
      if (process.env.NODE_ENV !== "production" && payload.devLoginUrl) {
        setDevLoginUrl(payload.devLoginUrl);
      }
    } catch {
      setError(auth.sendMailError);
      emailRef.current?.focus();
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <AuthShell title={auth.checkEmail} lang={locale} locale={locale} switcherLabel={messages.accessibility.languageSelector}>
        <p className="auth-lead">{auth.checkEmailBody}</p>
        <p className="auth-note" role="status">
          {auth.spamHint}
        </p>
        <p className="auth-secondary">
          <button type="button" className="auth-text-btn" onClick={() => setSent(false)}>
            {auth.requestNewLink}
          </button>
        </p>
        {devLoginUrl ? (
          <p className="auth-dev">
            {auth.devOnly} <a href={devLoginUrl}>{auth.openLink}</a>
          </p>
        ) : null}
      </AuthShell>
    );
  }

  return (
    <AuthShell title={auth.title} lang={locale} locale={locale} switcherLabel={messages.accessibility.languageSelector}>
      <p className="auth-lead">{auth.lead}</p>
      <form onSubmit={submit} aria-busy={loading} noValidate>
        <div className="auth-field">
          <label htmlFor={emailId}>{auth.emailLabel}</label>
          <input
            ref={emailRef}
            id={emailId}
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            placeholder={auth.emailPlaceholder}
            value={email}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            onChange={(event) => setEmail(event.target.value)}
          />
          {error ? (
            <p className="auth-error" id={errorId} role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <button className="auth-btn" type="submit" disabled={loading}>
          {loading ? auth.submitting : auth.submit}
        </button>
      </form>
      <p className="auth-secondary">
        <Link href={hrefForLocale("/login", locale)}>{auth.studioAccount}</Link>
      </p>
    </AuthShell>
  );
}
