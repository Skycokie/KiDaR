import { ID } from "node-appwrite";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/appwrite/client";

export async function POST(request: Request) {
  const body = (await request.json()) as { email?: string; next?: string };
  const email = body.email?.trim().toLowerCase();
  if (!email) return NextResponse.json({ error: "Email is required" }, { status: 400 });

  const next = body.next === "/creaza" ? "/creaza" : null;
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  const redirectUrl = `${origin}/auth/callback`;
  const { account } = createAdminClient();

  try {
    // Creates the account on first use and emails a magic URL with userId+secret.
    const token = await account.createMagicURLToken(ID.unique(), email, redirectUrl);
    const payload: { message: string; devLoginUrl?: string } = {
      message: "Check your email for the magic link."
    };

    // Appwrite Cloud shared SMTP often never delivers. In local/dev, surface the
    // same URL the email would have contained so you can sign in without SMTP.
    if (process.env.NODE_ENV !== "production") {
      payload.devLoginUrl = `${redirectUrl}?userId=${encodeURIComponent(token.userId)}&secret=${encodeURIComponent(token.secret)}`;
    }

    const response = NextResponse.json(payload);
    if (next) {
      response.cookies.set("kidar_next", next, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 10
      });
    }
    return response;
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Could not send magic link";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
