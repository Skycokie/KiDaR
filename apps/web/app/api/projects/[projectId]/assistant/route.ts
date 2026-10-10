import { NextResponse } from "next/server";
import { getLoggedInUser } from "@/lib/appwrite/client";
import { getProjectForOwner } from "@/lib/appwrite/db";
import { hasValidConsent } from "@/lib/consent";
import { runStudioAssistant } from "@/lib/ai/assistant";
import { isStudioAiChatEnabled } from "@/lib/ai/feature";
import { ASSISTANT_PROMPT_MAX, limitAssistantPrompt } from "@/lib/ai/schema";
import { consumeAiChatQuota } from "@/lib/ai/usage";

type Context = { params: { projectId: string } };

/**
 * Studio AI assistant — chooses motion/decor/palette/lighting from free text.
 * Never starts paid 3D generation; may return intent=suggest_3d for the UI to confirm.
 * Flag STUDIO_AI_CHAT_ENABLED must be on. Falls back to local keywords when AI fails.
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

  const body = (await request.json().catch(() => ({}))) as {
    prompt?: string;
    locale?: string;
  };
  const prompt = limitAssistantPrompt(typeof body.prompt === "string" ? body.prompt : "");
  if (!prompt.trim()) {
    return NextResponse.json({ error: "prompt_required", max: ASSISTANT_PROMPT_MAX }, { status: 400 });
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

  const result = await runStudioAssistant(
    { prompt, locale },
    { moderationFailOpen: true }
  );

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
    usage: { hourCount: quota.hourCount, dayCount: quota.dayCount }
  });
}
