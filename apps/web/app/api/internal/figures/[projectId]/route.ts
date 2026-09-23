import { NextResponse } from "next/server";
import {
  FigureStagingError,
  figureAssetsReadyKeys,
  figureStagingUiMessage,
  type FigureAssets
} from "@kidar/core";
import { getLoggedInUser } from "@/lib/appwrite/client";
import { getProjectForOwner } from "@/lib/appwrite/db";
import { isStagingRuntime } from "@/lib/staging-runtime";
import {
  assertStagingRuntimeForFigures,
  presignFigureAssetGets,
  resolveStagingR2PresignConfig
} from "@/lib/staging-r2-presign";

type Context = { params: { projectId: string } };

const NO_STORE = {
  "Cache-Control": "no-store",
  Pragma: "no-cache"
};

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

/**
 * Staging-only: short-lived R2 GetObject URLs for a ready figure.
 * Never accepts object keys from the client.
 */
export async function GET(_request: Request, { params }: Context) {
  if (!isStagingRuntime()) {
    return json({ error: "Not found" }, 404);
  }

  try {
    assertStagingRuntimeForFigures();
    // Fail closed before signing if bucket/Appwrite wiring is wrong.
    resolveStagingR2PresignConfig();
  } catch {
    return json({ error: "Not found" }, 404);
  }

  const user = await getLoggedInUser();
  if (!user) {
    return json({ error: "Unauthorized" }, 401);
  }

  const projectId = params.projectId?.trim();
  if (!projectId || projectId.includes("..") || projectId.includes("/") || projectId.includes("%")) {
    return json({ error: "Not found" }, 404);
  }

  const project = await getProjectForOwner(projectId, user.$id);
  if (!project) {
    return json({ error: "Not found" }, 404);
  }

  const assets = project.settings?.figureAssets as FigureAssets | undefined;
  if (!assets) {
    return json(
      {
        projectId,
        status: "pending",
        message: figureStagingUiMessage("pending")
      },
      200
    );
  }

  if (assets.status !== "ready") {
    return json(
      {
        projectId,
        status: assets.status,
        errorCode: assets.status === "failed" ? assets.errorCode : undefined,
        message: figureStagingUiMessage(assets.status, assets.errorCode)
      },
      200
    );
  }

  const keys = figureAssetsReadyKeys({ ...assets, projectId });
  if (!keys) {
    return json(
      {
        projectId,
        status: "processing",
        message: figureStagingUiMessage("processing")
      },
      200
    );
  }

  try {
    const signed = await presignFigureAssetGets({
      projectId,
      glbKey: keys.glbKey,
      usdzKey: keys.usdzKey
    });
    return json(
      {
        projectId,
        status: "ready",
        glbUrl: signed.glbUrl,
        usdzUrl: signed.usdzUrl,
        expiresAt: signed.expiresAt
      },
      200
    );
  } catch (error) {
    if (error instanceof FigureStagingError) {
      return json({ error: "Not found" }, 404);
    }
    return json({ error: "Not found" }, 404);
  }
}
