"use client";

import { FormEvent, useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [devLoginUrl, setDevLoginUrl] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setDevLoginUrl("");
    const response = await fetch("/api/auth/magic-link", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email })
    });
    const payload = (await response.json()) as {
      message?: string;
      error?: string;
      devLoginUrl?: string;
    };
    setMessage(payload.error ?? payload.message ?? "Check your email for the magic link.");
    setDevLoginUrl(payload.devLoginUrl ?? "");
    setLoading(false);
  }

  return (
    <main>
      <h1>Sign in to kidAR Studio</h1>
      <form onSubmit={submit}>
        <label>
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <button disabled={loading}>{loading ? "Sending…" : "Send magic link"}</button>
      </form>
      {message && <p role="status">{message}</p>}
      {devLoginUrl && (
        <p>
          Local development: Appwrite Cloud email often never arrives.{" "}
          <a href={devLoginUrl}>Open the sign-in link</a>
        </p>
      )}
    </main>
  );
}
