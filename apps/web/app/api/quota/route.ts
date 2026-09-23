import { NextResponse } from "next/server";
import { getLoggedInUser } from "@/lib/appwrite/client";
import { countProjectsForOwner, getProfile } from "@/lib/appwrite/db";
import { isQuotaBypassEnabled, projectQuotaLimit } from "@/lib/quota";

export async function GET() {
  const user = await getLoggedInUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const [used, profile] = await Promise.all([
      countProjectsForOwner(user.$id),
      getProfile(user.$id)
    ]);
    const plan = profile.plan === "paid" ? "paid" : "free";
    const limit = projectQuotaLimit(plan);
    const bypass = isQuotaBypassEnabled();
    return NextResponse.json({
      plan,
      used,
      limit,
      canCreate: bypass || used < limit,
      bypass
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Quota lookup failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
