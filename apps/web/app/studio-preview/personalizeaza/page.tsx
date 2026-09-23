import type { Metadata } from "next";
import { DM_Sans, Syne } from "next/font/google";
import { PersonalizePreviewShell } from "@/components/studio-personalize-preview";
import type { PreviewProjectContext } from "@/components/studio-personalize-preview/save-start-transform";
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

export const metadata: Metadata = {
  title: "kidAR Studio — personalizează",
  description: "Personalizează personajul pe scenă. Controalele rămân locale pe acest ecran."
};

type PageProps = {
  searchParams?: { projectId?: string | string[] };
};

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
    startPitch: typeof rotation?.x === "number" && Number.isFinite(rotation.x) ? rotation.x : null
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

  return (
    <div className={`${display.variable} ${body.variable}`}>
      <noscript>
        <p style={{ margin: "1rem", color: "#9aa3b5" }}>
          Activează JavaScript pentru Studio. Controalele de pe acest ecran nu deschid camera.
        </p>
      </noscript>
      <PersonalizePreviewShell drawingSrc={drawingSrc} projectContext={projectContext} />
    </div>
  );
}
