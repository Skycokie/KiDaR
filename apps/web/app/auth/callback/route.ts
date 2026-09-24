import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/appwrite/client";
import { SESSION_COOKIE } from "@/lib/appwrite/config";
import { ensureProfile } from "@/lib/appwrite/db";

export const dynamic = "force-dynamic";

function wantsCreaza(nextCookie: string | undefined, nextQuery: string | null) {
  return nextCookie === "/creaza" || nextQuery === "/creaza";
}

function htmlPage(title: string, body: string) {
  return `<!DOCTYPE html>
<html lang="ro">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    body { margin: 0; background: #faf8f5; }
    .auth-shell {
      box-sizing: border-box;
      min-height: 100vh;
      min-height: 100dvh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 32px 24px;
      background: #faf8f5;
      color: #17172a;
      font-family: system-ui, "Segoe UI", sans-serif;
      font-size: 1.0625rem;
      line-height: 1.45;
    }
    .auth-shell *, .auth-shell *::before, .auth-shell *::after { box-sizing: border-box; }
    .auth-card {
      width: min(420px, 100%);
      padding: 28px 24px 24px;
      background: #fffcf8;
      border: 1px solid #d9d3c8;
      border-radius: 18px;
    }
    .auth-eyebrow {
      margin: 0 0 12px;
      color: #5b4fe0;
      font-size: 0.8125rem;
      font-weight: 700;
      letter-spacing: 0.04em;
    }
    .auth-shell h1 {
      margin: 0 0 12px;
      color: #17172a;
      font-family: inherit;
      font-size: 1.75rem;
      font-weight: 700;
      line-height: 1.2;
      letter-spacing: -0.02em;
    }
    .auth-lead, .auth-note { margin: 0 0 20px; color: #4e4960; }
    .auth-note { margin-bottom: 0; font-size: 0.9375rem; }
    .auth-btn {
      display: flex;
      width: 100%;
      min-height: 48px;
      align-items: center;
      justify-content: center;
      margin-top: 20px;
      padding: 12px 16px;
      border: 0;
      border-radius: 16px;
      background: #5b4fe0;
      color: #fff;
      font: inherit;
      font-weight: 700;
      cursor: pointer;
    }
    .auth-secondary { margin: 16px 0 0; }
    .auth-secondary a {
      display: inline-flex;
      min-height: 48px;
      align-items: center;
      color: #5b4fe0;
      font-weight: 700;
    }
    .auth-shell small { color: #4e4960; }
    .auth-shell :focus-visible { outline: 3px solid #17172a; outline-offset: 3px; }
    @media (max-width: 480px) {
      .auth-shell { padding: 28px 20px; }
      .auth-card { padding: 24px 20px 20px; }
    }
    @media (prefers-reduced-motion: reduce) {
      .auth-shell *, .auth-shell *::before, .auth-shell *::after {
        transition: none;
        animation: none;
      }
    }
  </style>
</head>
<body>
<main class="auth-shell">
  <section class="auth-card">
    <p class="auth-eyebrow">kiDAR Studio</p>
    ${body}
  </section>
</main>
</body>
</html>`;
}

function htmlResponse(html: string, status = 200) {
  return new NextResponse(html, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "private, no-store, max-age=0"
    }
  });
}

function resolveOrigin(requestUrl: URL) {
  return process.env.NEXT_PUBLIC_APP_URL ?? requestUrl.origin;
}

function resolveNextPath(requestUrl: URL) {
  const nextCookie = cookies().get("kidar_next")?.value;
  return wantsCreaza(nextCookie, requestUrl.searchParams.get("next"))
    ? "/creaza"
    : "/studio";
}

/**
 * Magic-URL secrets are one-shot. Email scanners prefetch GET; we only exchange
 * the token on POST (human confirm). Use the admin Appwrite client for SSR
 * session minting — bare project clients fail createSession on the server.
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = resolveOrigin(requestUrl);
  const userId = requestUrl.searchParams.get("userId");
  const secret = requestUrl.searchParams.get("secret");
  const nextPath = resolveNextPath(requestUrl);
  const intra = new URL("/intra", origin).toString();

  if (!userId || !secret) {
    return htmlResponse(
      htmlPage(
        "Intră din nou",
        `<h1>Intră din nou</h1>
<p class="auth-lead">Linkul de intrare lipsește sau e incomplet.</p>
<p class="auth-secondary"><a href="${intra}">Cere o legătură nouă</a></p>`
      )
    );
  }

  const safeUserId = escapeHtml(userId);
  const safeSecret = escapeHtml(secret);
  const safeNext = escapeHtml(nextPath);

  return htmlResponse(
    htmlPage(
      "Confirmă intrarea",
      `<h1>Confirmă intrarea în kiDAR</h1>
<p class="auth-lead">Apasă butonul pentru a intra în kiDAR.</p>
<p class="auth-note">Confirmarea oprește scanerele de email să consume legătura înaintea ta.</p>
<form method="post" action="/auth/callback">
  <input type="hidden" name="userId" value="${safeUserId}">
  <input type="hidden" name="secret" value="${safeSecret}">
  <input type="hidden" name="next" value="${safeNext}">
  <button class="auth-btn" type="submit">Intră în kiDAR</button>
</form>
<p class="auth-secondary"><a href="${intra}">Cere o legătură nouă</a></p>`
    )
  );
}

export async function POST(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = resolveOrigin(requestUrl);
  const form = await request.formData();
  const userId = String(form.get("userId") ?? "").trim();
  const secret = String(form.get("secret") ?? "").trim();
  const nextFromForm = String(form.get("next") ?? "");
  const nextCookie = cookies().get("kidar_next")?.value;
  const nextPath = wantsCreaza(
    nextCookie,
    nextFromForm === "/creaza" ? "/creaza" : null
  )
    ? "/creaza"
    : "/studio";
  const destination = new URL(nextPath, origin).toString();
  const intra = new URL("/intra", origin).toString();

  if (nextCookie) {
    cookies().set("kidar_next", "", { path: "/", maxAge: 0 });
  }

  if (!userId || !secret) {
    return htmlResponse(
      htmlPage(
        "Intră din nou",
        `<h1>Intră din nou</h1>
<p class="auth-lead">Linkul de intrare lipsește sau e incomplet.</p>
<p class="auth-secondary"><a href="${intra}">Cere o legătură nouă</a></p>`
      ),
      400
    );
  }

  try {
    const { account } = createAdminClient();
    // Prefer the dedicated magic-URL route; fall back to generic token session.
    let session;
    try {
      session = await account.updateMagicURLSession({ userId, secret });
    } catch {
      session = await account.createSession({ userId, secret });
    }

    const response = NextResponse.redirect(destination, 303);
    response.cookies.set(SESSION_COOKIE, session.secret, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: new Date(session.expire)
    });
    try {
      await ensureProfile(userId);
    } catch {
      // Session is enough to enter; profile can be created on the next request.
    }
    return response;
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Eroare necunoscută";
    const type =
      cause && typeof cause === "object" && "type" in cause
        ? String((cause as { type?: string }).type ?? "")
        : "";
    const hint = type.includes("user_invalid_token") || /invalid|expired|used/i.test(message)
      ? "Linkul a fost deja folosit sau a expirat. Cere unul nou și apasă <strong>Intră în kiDAR</strong> o singură dată, din cel mai recent email."
      : "Nu am putut deschide sesiunea. Cere o legătură nouă și încearcă din nou.";

    return htmlResponse(
      htmlPage(
        "Link expirat",
        `<h1>Link expirat</h1>
<p class="auth-lead">${hint}</p>
<p><small>${escapeHtml(type || message)}</small></p>
<p class="auth-secondary"><a href="${intra}">Cere o legătură nouă</a></p>`
      ),
      401
    );
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
