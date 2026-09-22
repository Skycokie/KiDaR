import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { Client, Account } from "node-appwrite";
import {
  APPWRITE_ENDPOINT,
  APPWRITE_PROJECT_ID,
  SESSION_COOKIE
} from "@/lib/appwrite/config";
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
 * Magic-URL secrets are one-shot. Many email clients / link scanners issue a GET
 * prefetch that would burn the token before the human clicks. GET therefore only
 * shows a confirm button; the real exchange happens on POST.
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
  const nextPath = wantsCreaza(nextCookie, nextFromForm === "/creaza" ? "/creaza" : null)
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
    // Exchange without API key — magic URL session is a client auth flow.
    const client = new Client().setEndpoint(APPWRITE_ENDPOINT).setProject(APPWRITE_PROJECT_ID);
    const account = new Account(client);
    const session = await account.createSession(userId, secret);

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
    const detail =
      process.env.NODE_ENV !== "production" && cause instanceof Error
        ? `<p><small>${escapeHtml(cause.message)}</small></p>`
        : "";
    return htmlResponse(
      htmlPage(
        "Link expirat",
        `<p>Linkul a expirat sau a fost deja folosit.</p>
${detail}
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
