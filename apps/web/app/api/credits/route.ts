import { NextResponse } from "next/server";
import { getLoggedInUser } from "@/lib/appwrite/client";
import { getProfile } from "@/lib/appwrite/db";
import { FIGURINE_CREDIT_COST, isCreditsBypassEnabled } from "@/lib/credits";

export async function GET() {
  const user = await getLoggedInUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const profile = await getProfile(user.$id);
    const bypass = isCreditsBypassEnabled();
    return NextResponse.json({
      credits: profile.credits,
      costPerFigurine: FIGURINE_CREDIT_COST,
      canGenerate: bypass || profile.credits >= FIGURINE_CREDIT_COST,
      bypass
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Credits lookup failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
