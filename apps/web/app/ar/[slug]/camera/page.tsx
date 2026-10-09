import type { Metadata } from "next";
import { getMessages } from "@/i18n/get-messages";
import { getRequestLocale } from "@/i18n/get-request-locale";
import { loadCameraView } from "@/lib/camera-view";
import { CameraViewClient } from "@/components/ar-camera/camera-view-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false }
};

type PageProps = {
  params: { slug: string };
  searchParams?: { model?: string | string[] };
};

export default async function ArCameraPage({ params, searchParams }: PageProps) {
  const copy = getMessages(getRequestLocale()).ar;
  const rawModel = searchParams?.model;
  const state = await loadCameraView({
    slug: params.slug,
    modelParam: Array.isArray(rawModel) ? rawModel[0] : rawModel,
    env: process.env
  });

  if (state.kind === "not_public") {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#0f1419",
          color: "#f4f7fb",
          fontFamily: "system-ui, sans-serif"
        }}
      >
        <p>{copy.notPublic}</p>
      </main>
    );
  }

  return (
    <CameraViewClient
      modelUrl={state.modelUrl}
      qrDataUrl={state.qrDataUrl}
      arPageHref={state.arPageHref}
      copy={copy}
    />
  );
}
