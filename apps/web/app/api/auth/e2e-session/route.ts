import { ID, Query } from "node-appwrite";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/appwrite/client";
import { SESSION_COOKIE } from "@/lib/appwrite/config";
import { ensureProfile } from "@/lib/appwrite/db";

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_E2E_AUTH !== "true") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const body = (await request.json()) as { email?: string };
  const email = body.email?.trim().toLowerCase();
  if (!email) return NextResponse.json({ error: "Email is required" }, { status: 400 });

  const { users } = createAdminClient();
  let userId: string | null = null;

  // Prefer exact email query — `search` can time out on larger user sets.
  try {
    const listed = await users.list([Query.equal("email", email), Query.limit(1)]);
    userId = listed.users[0]?.$id ?? null;
  } catch {
    userId = null;
  }

  if (!userId) {
    const created = await users.create(ID.unique(), email, undefined, `E2E-${ID.unique()}a1`);
    userId = created.$id;
  }

  const session = await users.createSession(userId);
  cookies().set(SESSION_COOKIE, session.secret, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(session.expire)
  });
  // Profile is nice-to-have for Studio plan; don't fail login if Appwrite DB times out.
  try {
    await ensureProfile(userId);
  } catch {
    // best-effort
  }

  return NextResponse.json({ ok: true, userId });
}
