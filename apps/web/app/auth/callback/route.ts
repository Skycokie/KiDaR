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
    a { color: #5b4fe0; }
  </style>
</head>
<body>${body}</body>
</html>`;
}

function htmlResponse(html: string) {
  return new NextResponse(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "private, no-store, max-age=0"
    }
  });
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? requestUrl.origin;
  const userId = requestUrl.searchParams.get("userId");
  const secret = requestUrl.searchParams.get("secret");
  const nextCookie = cookies().get("kidar_next")?.value;
  const nextPath = wantsCreaza(nextCookie, requestUrl.searchParams.get("next"))
    ? "/creaza"
    : "/dashboard";
  const destination = new URL(nextPath, origin).toString();

  const response = htmlResponse(
    htmlPage(
      "Intrare…",
      `<p>Te ducem mai departe…</p>
<meta http-equiv="refresh" content="0;url=${destination}">
<script>location.replace(${JSON.stringify(destination)});</script>
<p><a href="${destination}">Continuă</a></p>`
    )
  );

  if (nextCookie) {
    response.cookies.set("kidar_next", "", { path: "/", maxAge: 0 });
  }

  if (!userId || !secret) {
    return htmlResponse(
      htmlPage(
        "Intră din nou",
        `<p>Linkul de intrare lipsește sau e incomplet.</p>
<p><a href="${new URL("/intra", origin).toString()}">Cere o legătură nouă</a></p>`
      )
    );
  }

  try {
    const { account } = createAdminClient();
    const session = await account.createSession(userId, secret);
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
  } catch {
    return htmlResponse(
      htmlPage(
        "Link expirat",
        `<p>Linkul a expirat sau a fost deja folosit.</p>
<p><a href="${new URL("/intra", origin).toString()}">Cere o legătură nouă</a></p>`
      )
    );
  }
}
