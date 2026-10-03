import type { Metadata } from "next";
import { DM_Sans, Syne } from "next/font/google";
import { readFigureFeatureFlags } from "@kidar/core";
import {
  creativeIdeaPrompt,
  parseCreativeStartingPoint,
  parseCreativeSuggestionIndex
} from "@/components/creaza-preview/starting-point";
import { StudioI18nProvider } from "@/components/i18n/studio-i18n";
import { PersonalizePreviewShell } from "@/components/studio-personalize-preview";
import type { PreviewProjectContext } from "@/components/studio-personalize-preview/save-start-transform";
import { parseArAnchorMode } from "@/components/studio-personalize-preview/save-start-transform";
import { getMessages } from "@/i18n/get-messages";
import { getRequestLocale } from "@/i18n/get-request-locale";
import { getLoggedInUser } from "@/lib/appwrite/client";
import { getProjectForOwner } from "@/lib/appwrite/db";
import { createSignedSourceUrl } from "@/lib/appwrite/storage";

const display = Syne({
  subsets: ["latin"],
  variable: "--font-studio-display",
  display: "swap"
});

const body = DM_Sans({
  subsets: ["latin"],
  variable: "--font-studio-body",
  display: "swap"
});

export async function generateMetadata(): Promise<Metadata> {
  const t = getMessages(getRequestLocale()).personalize;
  return { title: t.metaTitle, description: t.metaDescription };
}

type PageProps = {
  searchParams?: { projectId?: string | string[]; from?: string | string[]; hint?: string | string[] };
};

function optionalUrl(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

async function loadOwnedPreview(projectId: string | undefined): Promise<{
  drawingSrc: string | null;
  projectContext: PreviewProjectContext | null;
}> {
  if (!projectId) return { drawingSrc: null, projectContext: null };
  const user = await getLoggedInUser();
  if (!user) return { drawingSrc: null, projectContext: null };
  const project = await getProjectForOwner(projectId, user.$id);
  if (!project) return { drawingSrc: null, projectContext: null };
  const offset = project.settings?.offset;
  const rotation = project.settings?.scene?.startTransform?.rotation;
  const settings = project.settings ?? {};
  const projectContext: PreviewProjectContext = {
    projectId: project.id,
    scale:
      typeof project.settings?.scale === "number" && Number.isFinite(project.settings.scale)
        ? project.settings.scale
        : 1,
    offset: {
      x: typeof offset?.x === "number" && Number.isFinite(offset.x) ? offset.x : 0,
      y: typeof offset?.y === "number" && Number.isFinite(offset.y) ? offset.y : 0,
      z: typeof offset?.z === "number" && Number.isFinite(offset.z) ? offset.z : 0
    },
    startYaw: typeof rotation?.y === "number" && Number.isFinite(rotation.y) ? rotation.y : null,
    startPitch: typeof rotation?.x === "number" && Number.isFinite(rotation.x) ? rotation.x : null,
    arAnchorMode: parseArAnchorMode(project.settings?.scene?.arAnchorMode),
    publicHtmlUrl: optionalUrl(settings.publicHtmlUrl),
    publicQrUrl: optionalUrl(settings.publicQrUrl),
    publicPdfUrl: optionalUrl(settings.publicPdfUrl),
    publicExperienceUrl: optionalUrl(settings.publicExperienceUrl),
    arFeatureEnabled: readFigureFeatureFlags(process.env).ar
  };
  const drawingSrc = project.source_image_path
    ? await createSignedSourceUrl(project.source_image_path, 60 * 30)
    : null;
  return { drawingSrc, projectContext };
}

export default async function StudioPersonalizePreviewPage({ searchParams }: PageProps) {
  const raw = searchParams?.projectId;
  const projectId = typeof raw === "string" ? raw.trim() : Array.isArray(raw) ? raw[0]?.trim() : "";
  const { drawingSrc, projectContext } = await loadOwnedPreview(projectId || undefined);
  const locale = getRequestLocale();
  const from = parseCreativeStartingPoint(searchParams?.from);
  const hint = parseCreativeSuggestionIndex(searchParams?.hint);
  const initialIdeaPrompt = from ? creativeIdeaPrompt(getMessages(locale).creaza.preset, from, hint) : "";

  return (
    <div className={`${display.variable} ${body.variable}`}>
      <noscript>
        <p style={{ margin: "1rem", color: "#9aa3b5" }}>{getMessages(locale).personalize.noscript}</p>
      </noscript>
      <StudioI18nProvider locale={locale}>
        <PersonalizePreviewShell
          drawingSrc={drawingSrc}
          projectContext={projectContext}
          initialIdeaPrompt={initialIdeaPrompt}
        />
      </StudioI18nProvider>
    </div>
  );
}
