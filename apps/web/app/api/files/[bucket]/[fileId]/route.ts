import { NextResponse } from "next/server";
import { getLoggedInUser, createSessionClient } from "@/lib/appwrite/client";
import { APPWRITE_ASSETS_BUCKET, APPWRITE_SOURCE_BUCKET } from "@/lib/appwrite/config";

type Context = { params: { bucket: string; fileId: string } };

const allowedBuckets = new Set([APPWRITE_SOURCE_BUCKET, APPWRITE_ASSETS_BUCKET]);

export async function GET(_request: Request, { params }: Context) {
  const user = await getLoggedInUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!allowedBuckets.has(params.bucket)) {
    return NextResponse.json({ error: "Unknown bucket" }, { status: 404 });
  }

  try {
    const { storage } = createSessionClient();
    const bytes = await storage.getFileView(params.bucket, params.fileId);
    const file = await storage.getFile(params.bucket, params.fileId);
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "content-type": file.mimeType || "application/octet-stream",
        "cache-control": "private, max-age=60"
      }
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "File not found";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
