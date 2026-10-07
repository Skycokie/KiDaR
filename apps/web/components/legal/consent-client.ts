import type { ConsentKind } from "@/lib/consent";

export function consentApiPath(): string {
  return "/api/consent";
}

/** Records a consent on the signed-in account. Returns false on any failure. */
export async function postConsent(
  kind: ConsentKind,
  fetchImpl: typeof fetch = fetch
): Promise<boolean> {
  try {
    const response = await fetchImpl(consentApiPath(), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind })
    });
    return response.ok;
  } catch {
    return false;
  }
}
