"use client";

import { FormEvent, useId, useRef, useState } from "react";
import { AuthShell } from "@/components/auth/auth-shell";

const SENT_BODY =
  "Ți-am trimis o legătură de intrare. Deschide emailul și apasă butonul pentru a continua.";
const SENT_NOTE = "Dacă nu vezi mesajul, verifică folderul Spam sau cere o legătură nouă.";
const ERROR_COPY = "Nu am putut trimite legătura. Verifică adresa și încearcă din nou.";
const INVALID_COPY = "Introdu o adresă de email validă.";

export default function LoginPage() {
  const emailId = useId();
  const errorId = useId();
  const emailRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [messageSent, setMessageSent] = useState(false);
  const [error, setError] = useState("");
  const [devLoginUrl, setDevLoginUrl] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || !emailRef.current?.checkValidity()) {
      setError(INVALID_COPY);
      emailRef.current?.focus();
      return;
    }
    setLoading(true);
    setError("");
    setDevLoginUrl("");
    try {
      const response = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: trimmed })
      });
      const payload = (await response.json()) as { devLoginUrl?: string };
      if (!response.ok) {
        setError(ERROR_COPY);
        emailRef.current?.focus();
        return;
      }
      setMessageSent(true);
      setDevLoginUrl(payload.devLoginUrl ?? "");
    } catch {
      setError(ERROR_COPY);
      emailRef.current?.focus();
    } finally {
      setLoading(false);
    }
  }

  if (messageSent) {
    return (
      <AuthShell title="Verifică emailul">
        <p className="auth-lead">{SENT_BODY}</p>
        <p className="auth-note" role="status">
          {SENT_NOTE}
        </p>
        <p className="auth-secondary">
          <button type="button" className="auth-text-btn" onClick={() => setMessageSent(false)}>
            Cere o legătură nouă
          </button>
        </p>
        {devLoginUrl ? (
          <p className="auth-dev">
            Doar pe acest computer: <a href={devLoginUrl}>deschide legătura de intrare</a>
          </p>
        ) : null}
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Intră în kiDAR">
      <p className="auth-lead">Folosești doar adresa de email. Fără parolă.</p>
      <form onSubmit={submit} aria-busy={loading} noValidate>
        <div className="auth-field">
          <label htmlFor={emailId}>Email</label>
          <input
            ref={emailRef}
            id={emailId}
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            placeholder="nume@exemplu.ro"
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
          {loading ? "Se trimite…" : "Trimite legătura de intrare"}
        </button>
      </form>
    </AuthShell>
  );
}
