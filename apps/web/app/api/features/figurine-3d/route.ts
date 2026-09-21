import { NextResponse } from "next/server";
import { figurineUiReasonMessage } from "@kidar/core";
import { isFigurineFeatureEnabled } from "@/lib/figurine-feature";

/**
 * Public-ish availability probe for Studio.
 * Never inspects or echoes TRIPO_API_KEY / Tripo config.
 */
export async function GET() {
  const enabled = isFigurineFeatureEnabled();
  if (!enabled) {
    return NextResponse.json({
      enabled: false,
      available: false,
      reason: figurineUiReasonMessage("feature_gated")
    });
  }
  return NextResponse.json({
    enabled: true,
    available: true
  });
}
