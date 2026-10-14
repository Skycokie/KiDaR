/**
 * Studio AI chat feature flag. Default off — never enable on production without PR C + approval.
 */

function isExplicitTrue(value: string | undefined): boolean {
  return value === "1" || value === "true";
}

export function isStudioAiChatEnabled(
  env: Record<string, string | undefined> = process.env
): boolean {
  return isExplicitTrue(env.STUDIO_AI_CHAT_ENABLED);
}

export function isFigureText3dEnabled(
  env: Record<string, string | undefined> = process.env
): boolean {
  return isExplicitTrue(env.FIGURE_TEXT_3D_ENABLED);
}

export function resolveAiChatApiKey(
  env: Record<string, string | undefined> = process.env
): string | null {
  const key = env.OPENAI_API_KEY?.trim() || env.AI_CHAT_API_KEY?.trim();
  return key || null;
}

export function resolveAiChatModel(
  env: Record<string, string | undefined> = process.env
): string {
  return env.AI_CHAT_MODEL?.trim() || "gpt-4o-mini";
}
