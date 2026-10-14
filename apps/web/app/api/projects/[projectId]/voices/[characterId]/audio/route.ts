import { NextResponse } from "next/server";
import {
  CHARACTER_VOICE_AUDIO_MAX_BYTES,
  isAllowedVoiceAudioType,
  isValidCharacterId,
  normalizeCharacterVoice,
  readCharacterVoice,
  upsertCharacterVoice
} from "@kidar/core";
import { getLoggedInUser } from "@/lib/appwrite/client";
import { getProjectForOwner, updateProjectDocument } from "@/lib/appwrite/db";
import { hasValidConsent } from "@/lib/consent";
import {
  createSignedAssetUrl,
  uploadCharacterVoiceAudio
} from "@/lib/appwrite/storage";

type Context = { params: { projectId: string; characterId: string } };

export async function POST(request: Request, { params }: Context) {
  const user = await getLoggedInUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isValidCharacterId(params.characterId)) {
    return NextResponse.json(
      { error: "invalid_character_id", message: "Identificatorul personajului nu este valid." },
      { status: 400 }
    );
  }

  if (!hasValidConsent(user.prefs, "voice")) {
    return NextResponse.json(
      { error: "consent_required", message: "Voice consent required." },
      { status: 403 }
    );
  }

  const project = await getProjectForOwner(params.projectId, user.$id);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "missing_file", message: "Alege sau înregistrează un fișier audio." },
      { status: 400 }
    );
  }

  const mime = file.type || "application/octet-stream";
  if (!isAllowedVoiceAudioType(mime)) {
    return NextResponse.json(
      {
        error: "unsupported_type",
        message: "Folosește MP3, M4A, WebM sau OGG, până la 2 MB."
      },
      { status: 415 }
    );
  }
  if (file.size > CHARACTER_VOICE_AUDIO_MAX_BYTES) {
    return NextResponse.json(
      {
        error: "too_large",
        message: "Audio-ul poate avea cel mult 2 MB (cam 30 de secunde)."
      },
      { status: 413 }
    );
  }

  const existing = readCharacterVoice(project.settings?.characterVoices, params.characterId);
  if (!existing) {
    return NextResponse.json(
      {
        error: "voice_required",
        message: "Salvează întâi rolul și mesajul, apoi încarcă audio-ul."
      },
      { status: 400 }
    );
  }

  try {
    const path = await uploadCharacterVoiceAudio(
      user.$id,
      params.projectId,
      params.characterId,
      file
    );
    const normalized = normalizeCharacterVoice({
      characterId: params.characterId,
      role: existing.role,
      message: existing.message,
      audioPath: path
    });
    if (!normalized.ok) {
      return NextResponse.json(
        { error: normalized.code, message: normalized.message },
        { status: 400 }
      );
    }

    const settings = {
      ...project.settings,
      characterVoices: upsertCharacterVoice(
        project.settings?.characterVoices,
        normalized.characterId,
        normalized.voice
      )
    };
    await updateProjectDocument(params.projectId, { settings });
    const audioUrl = await createSignedAssetUrl(path, 60 * 15);
    return NextResponse.json({
      characterId: params.characterId,
      voice: {
        role: normalized.voice.role,
        message: normalized.voice.message,
        hasAudio: true
      },
      audioUrl,
      path
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
