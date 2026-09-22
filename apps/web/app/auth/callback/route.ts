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
    body { margin: 0; min-height: 100vh; background: #f7f4ee; color: #1b1726;
      font-family: system-ui, "Segoe UI", sans-serif; font-size: 1.125rem; line-height: 1.45;
      padding: 1.5rem; }
    a, button { color: #5b4fe0; }
    form { margin-top: 1rem; }
    button {
      appearance: none; border: 0; background: #5b4fe0; color: #fff;
      font: inherit; padding: 0.75rem 1.25rem; border-radius: 999px; cursor: pointer;
    }
    small { color: #5c5668; }
  </style>
</head>
<body>${body}</body>
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
        `<p>Linkul de intrare lipsește sau e incomplet.</p>
<p><a href="${intra}">Cere o legătură nouă</a></p>`
      )
    );
  }

  const safeUserId = escapeHtml(userId);
  const safeSecret = escapeHtml(secret);
  const safeNext = escapeHtml(nextPath);

  return htmlResponse(
    htmlPage(
      "Confirmă intrarea",
      `<p>Apasă butonul ca să intri în KIDAR. (Confirmarea oprește scanerele de email să consume linkul înaintea ta.)</p>
<form method="post" action="/auth/callback">
  <input type="hidden" name="userId" value="${safeUserId}">
  <input type="hidden" name="secret" value="${safeSecret}">
  <input type="hidden" name="next" value="${safeNext}">
  <button type="submit">Intră în KIDAR</button>
</form>
<p><a href="${intra}">Cere o legătură nouă</a></p>`
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
        `<p>Linkul de intrare lipsește sau e incomplet.</p>
<p><a href="${intra}">Cere o legătură nouă</a></p>`
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
      ? "Linkul a fost deja folosit sau a expirat. Cere unul nou și apasă <strong>Intră în KIDAR</strong> o singură dată, din cel mai recent email."
      : "Nu am putut deschide sesiunea. Cere o legătură nouă și încearcă din nou.";

    return htmlResponse(
      htmlPage(
        "Link expirat",
        `<p>${hint}</p>
<p><small>${escapeHtml(type || message)}</small></p>
<p><a href="${intra}">Cere o legătură nouă</a></p>`
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
