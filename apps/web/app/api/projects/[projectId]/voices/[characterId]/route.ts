import { NextResponse } from "next/server";
import {
  isValidCharacterId,
  normalizeCharacterVoice,
  readCharacterVoice,
  removeCharacterVoice,
  upsertCharacterVoice
} from "@kidar/core";
import { getLoggedInUser } from "@/lib/appwrite/client";
import { getProjectForOwner, updateProjectDocument } from "@/lib/appwrite/db";
import {
  APPWRITE_ASSETS_BUCKET,
  createSignedAssetUrl,
  deleteStorageFiles
} from "@/lib/appwrite/storage";

type Context = { params: { projectId: string; characterId: string } };

function invalidCharacterResponse() {
  return NextResponse.json(
    { error: "invalid_character_id", message: "Identificatorul personajului nu este valid." },
    { status: 400 }
  );
}

export async function GET(_request: Request, { params }: Context) {
  const user = await getLoggedInUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isValidCharacterId(params.characterId)) return invalidCharacterResponse();

  const project = await getProjectForOwner(params.projectId, user.$id);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const voice = readCharacterVoice(project.settings?.characterVoices, params.characterId);
  if (!voice) {
    return NextResponse.json({
      characterId: params.characterId,
      voice: null,
      audioUrl: null
    });
  }

  const audioUrl = voice.audioPath
    ? await createSignedAssetUrl(voice.audioPath, 60 * 15)
    : null;

  return NextResponse.json({
    characterId: params.characterId,
    voice: {
      role: voice.role,
      message: voice.message,
      hasAudio: Boolean(voice.audioPath)
    },
    audioUrl
  });
}

export async function PATCH(request: Request, { params }: Context) {
  const user = await getLoggedInUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isValidCharacterId(params.characterId)) return invalidCharacterResponse();

  const project = await getProjectForOwner(params.projectId, user.$id);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as {
    role?: unknown;
    message?: unknown;
  };

  const existing = readCharacterVoice(project.settings?.characterVoices, params.characterId);
  const normalized = normalizeCharacterVoice({
    characterId: params.characterId,
    role: body.role,
    message: body.message,
    audioPath: existing?.audioPath ?? null
  });

  if (!normalized.ok) {
    return NextResponse.json(
      { error: normalized.code, message: normalized.message },
      { status: 400 }
    );
  }

  try {
    const settings = {
      ...project.settings,
      characterVoices: upsertCharacterVoice(
        project.settings?.characterVoices,
        normalized.characterId,
        normalized.voice
      )
    };
    const updated = await updateProjectDocument(params.projectId, { settings });
    const voice = readCharacterVoice(updated.settings?.characterVoices, params.characterId);
    const audioUrl = voice?.audioPath
      ? await createSignedAssetUrl(voice.audioPath, 60 * 15)
      : null;
    return NextResponse.json({
      characterId: params.characterId,
      voice: voice
        ? { role: voice.role, message: voice.message, hasAudio: Boolean(voice.audioPath) }
        : null,
      audioUrl
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Update failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Context) {
  const user = await getLoggedInUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isValidCharacterId(params.characterId)) return invalidCharacterResponse();

  const project = await getProjectForOwner(params.projectId, user.$id);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const existing = readCharacterVoice(project.settings?.characterVoices, params.characterId);
  if (existing?.audioPath) {
    await deleteStorageFiles(APPWRITE_ASSETS_BUCKET, [existing.audioPath]);
  }

  try {
    const settings = {
      ...project.settings,
      characterVoices: removeCharacterVoice(
        project.settings?.characterVoices,
        params.characterId
      )
    };
    await updateProjectDocument(params.projectId, { settings });
    return NextResponse.json({
      characterId: params.characterId,
      voice: null,
      audioUrl: null
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Delete failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
