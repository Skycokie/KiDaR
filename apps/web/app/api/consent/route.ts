import { NextResponse } from "next/server";
import { createSessionClient, getLoggedInUser } from "@/lib/appwrite/client";
import {
  CONSENT_VERSION,
  consentStatus,
  hasValidConsent,
  isConsentKind,
  withConsent
} from "@/lib/consent";

export const dynamic = "force-dynamic";

/** Current consent status of the signed-in account. */
export async function GET() {
  const user = await getLoggedInUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ version: CONSENT_VERSION, consent: consentStatus(user.prefs) });
}

/** Records a consent (`{ "kind": "parent" | "voice" | "ai" }`) with version and timestamp. */
export async function POST(request: Request) {
  const user = await getLoggedInUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const kind = (body as { kind?: unknown } | null)?.kind;
  if (!isConsentKind(kind)) {
    return NextResponse.json({ error: "Invalid consent kind" }, { status: 400 });
  }

  // Already recorded for this policy version: keep the original timestamp.
  if (!hasValidConsent(user.prefs, kind)) {
    try {
      const { account } = createSessionClient();
      const current = await account.getPrefs();
      await account.updatePrefs({ prefs: withConsent(current, kind) });
    } catch {
      return NextResponse.json({ error: "Could not save consent" }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, kind, version: CONSENT_VERSION });
}
