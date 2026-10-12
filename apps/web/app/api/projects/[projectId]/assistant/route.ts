import { NextResponse } from "next/server";
import { getLoggedInUser } from "@/lib/appwrite/client";
import { getProjectForOwner } from "@/lib/appwrite/db";
import { hasValidConsent } from "@/lib/consent";
import { runStudioAssistant } from "@/lib/ai/assistant";
import { isStudioAiChatEnabled } from "@/lib/ai/feature";
import {
  ASSISTANT_BODY_MAX,
  ASSISTANT_HISTORY_MAX,
  ASSISTANT_PROMPT_MAX,
  parseAssistantHistory,
  stripLinks
} from "@/lib/ai/schema";
import { AI_CHAT_DAY_LIMIT, AI_CHAT_HOUR_LIMIT, consumeAiChatQuota } from "@/lib/ai/usage";

type Context = { params: { projectId: string } };

/**
 * Studio AI chat — text only. Chooses motion/decor/palette/lighting and may return plain-text
 * suggestions (improved prompt, style directions) from the user's message plus a short
 * in-memory history sent by the client (never stored here).
 *
 * Request (backward compatible): { prompt, locale?, history?: [{ role, content }] }.
 * Never receives or forwards images, urls or storage paths. Never starts 3D generation:
 * intent=suggest_3d is only a pointer for the UI.
 * Fail-closed: moderation or provider unavailable → explicit error, nothing is forwarded.
 * Flag STUDIO_AI_CHAT_ENABLED must be on.
 */
export async function POST(request: Request, { params }: Context) {
  const user = await getLoggedInUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isStudioAiChatEnabled()) {
    return NextResponse.json({ error: "ai_disabled", code: "flag_off" }, { status: 403 });
  }

  if (!hasValidConsent(user.prefs, "parent")) {
    return NextResponse.json({ error: "consent_required", code: "parent" }, { status: 403 });
  }
  if (!hasValidConsent(user.prefs, "ai")) {
    return NextResponse.json({ error: "consent_required", code: "ai" }, { status: 403 });
  }

  const project = await getProjectForOwner(params.projectId, user.$id);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  // Validate everything before touching the quota: invalid input must never cost a message.
  const rawText = await request.text().catch(() => "");
  if (rawText.length > ASSISTANT_BODY_MAX) {
    return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  }
  let body: { prompt?: unknown; locale?: unknown; history?: unknown } = {};
  try {
    const parsed: unknown = rawText ? JSON.parse(rawText) : {};
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      body = parsed as typeof body;
    }
  } catch {
    body = {};
  }

  if (body.prompt !== undefined && typeof body.prompt !== "string") {
    return NextResponse.json({ error: "prompt_invalid" }, { status: 400 });
  }
  const rawPrompt = typeof body.prompt === "string" ? body.prompt.replace(/\u0000/g, "") : "";
  if (!rawPrompt.trim()) {
    return NextResponse.json({ error: "prompt_required", max: ASSISTANT_PROMPT_MAX }, { status: 400 });
  }
  if (rawPrompt.length > ASSISTANT_PROMPT_MAX) {
    return NextResponse.json({ error: "prompt_too_long", max: ASSISTANT_PROMPT_MAX }, { status: 400 });
  }
  const prompt = stripLinks(rawPrompt);
  if (!prompt) {
    return NextResponse.json({ error: "prompt_required", max: ASSISTANT_PROMPT_MAX }, { status: 400 });
  }

  const history = parseAssistantHistory(body.history);
  if (!history.ok) {
    return NextResponse.json({ error: "history_invalid", max: ASSISTANT_HISTORY_MAX }, { status: 400 });
  }
  const locale = body.locale === "en" ? "en" : "ro";

  const quota = await consumeAiChatQuota(user.$id);
  if (!quota.ok) {
    const status = quota.code === "rate_limited" ? 429 : 503;
    return NextResponse.json(
      {
        error: quota.code,
        hourCount: quota.hourCount ?? null,
        dayCount: quota.dayCount ?? null
      },
      { status }
    );
  }

  const usage = {
    hourCount: quota.hourCount,
    dayCount: quota.dayCount,
    hourLimit: AI_CHAT_HOUR_LIMIT,
    dayLimit: AI_CHAT_DAY_LIMIT
  };

  const result = await runStudioAssistant({ prompt, locale, history: history.history });

  if (!result.ok) {
    // Fixed, safe codes only: never the provider's raw message.
    const status = result.error === "moderation_unavailable" ? 503 : 502;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({
    source: result.source,
    reply: result.reply.reply,
    intent: result.reply.intent,
    settings: {
      motion: result.reply.motion ?? null,
      decor: result.reply.decor ?? null,
      palette: result.reply.palette ?? null,
      lighting: result.reply.lighting ?? null
    },
    suggestions: result.reply.suggestions ?? [],
    usage
  });
}
