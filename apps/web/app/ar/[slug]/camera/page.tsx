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
  searchParams?: {
    model?: string | string[];
    rx?: string | string[];
    ry?: string | string[];
    rz?: string | string[];
  };
};

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ArCameraPage({ params, searchParams }: PageProps) {
  const copy = getMessages(getRequestLocale()).ar;
  const state = await loadCameraView({
    slug: params.slug,
    modelParam: firstParam(searchParams?.model),
    rx: firstParam(searchParams?.rx),
    ry: firstParam(searchParams?.ry),
    rz: firstParam(searchParams?.rz),
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
      orientation={state.orientation}
      qrDataUrl={state.qrDataUrl}
      arPageHref={state.arPageHref}
      copy={copy}
    />
  );
}
