import { ID } from "node-appwrite";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/appwrite/client";

export async function POST(request: Request) {
  const body = (await request.json()) as { email?: string };
  const email = body.email?.trim().toLowerCase();
  if (!email) return NextResponse.json({ error: "Email is required" }, { status: 400 });

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  const redirectUrl = `${origin}/auth/callback`;
  const { account } = createAdminClient();

  try {
    // Creates the account on first use and emails a magic URL with userId+secret.
    await account.createMagicURLToken(ID.unique(), email, redirectUrl);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Could not send magic link";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ message: "Check your email for the magic link." });
}
