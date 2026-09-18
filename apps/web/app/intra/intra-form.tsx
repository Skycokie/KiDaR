"use client";

import Link from "next/link";
import { FormEvent, useId, useRef, useState } from "react";

const SENT_COPY =
  "Uită-te în email, inclusiv în folderul Spam. Apasă legătura ca să continui.";
const ERROR_COPY = "Nu am putut trimite emailul. Verifică adresa și încearcă din nou.";

export function IntraForm() {
  const emailId = useId();
  const errorId = useId();
  const emailRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [devLoginUrl, setDevLoginUrl] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || !emailRef.current?.checkValidity()) {
      setError(ERROR_COPY);
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
      const payload = (await response.json()) as { error?: string; devLoginUrl?: string };
      if (!response.ok) {
        setError(ERROR_COPY);
        emailRef.current?.focus();
        return;
      }
      setSent(true);
      if (process.env.NODE_ENV !== "production" && payload.devLoginUrl) {
        setDevLoginUrl(payload.devLoginUrl);
      }
    } catch {
      setError(ERROR_COPY);
      emailRef.current?.focus();
    } finally {
      setLoading(false);
    }
  }

  const describedBy = error ? errorId : undefined;

  return (
    <>
      <form onSubmit={submit} aria-busy={loading} noValidate>
        <div className="creaza-field">
          <label htmlFor={emailId}>Email</label>
          <input
            ref={emailRef}
            id={emailId}
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            onChange={(event) => setEmail(event.target.value)}
          />
          {error ? (
            <p className="creaza-error" id={errorId} role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <button className="creaza-btn creaza-btn-primary" type="submit" disabled={loading}>
          {loading ? "Se trimite…" : sent ? "Trimite din nou" : "Trimite legătura de intrare"}
        </button>
      </form>
      {sent ? (
        <p className="creaza-status" role="status">
          {SENT_COPY}
        </p>
      ) : null}
      {devLoginUrl ? (
        <p className="creaza-note">
          Doar pe acest computer: <a href={devLoginUrl}>deschide legătura de intrare</a>
        </p>
      ) : null}
      <p className="creaza-note">
        <Link href="/login">Am deja un cont Studio (English)</Link>
      </p>
    </>
  );
}
