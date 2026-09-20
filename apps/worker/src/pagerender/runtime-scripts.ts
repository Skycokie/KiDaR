import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { PageRenderError } from "@kidar/core";
import {
  AFRAME_RUNTIME_OBJECT_KEY,
  AFRAME_UPSTREAM_SCRIPT_URL,
  MINDAR_RUNTIME_OBJECT_KEY
} from "./runtime-keys";

export type ArRuntimeScript = { key: string; body: Uint8Array };

const require = createRequire(import.meta.url);

async function fetchScriptBytes(url: string, label: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new PageRenderError(`${label} runtime fetch HTTP ${response.status}`, {
      retryable: true,
      code: "RUNTIME_FETCH_FAILED"
    });
  }
  return new Uint8Array(await response.arrayBuffer());
}

export async function loadDefaultArRuntimeScripts(): Promise<ArRuntimeScript[]> {
  let mindarPath: string;
  try {
    mindarPath = require.resolve("mind-ar/dist/mindar-image-aframe.prod.js");
  } catch {
    throw new PageRenderError("mind-ar A-Frame bundle is missing from the worker image", {
      retryable: false,
      code: "MISSING_MINDAR_RUNTIME"
    });
  }
  const mindar = new Uint8Array(await readFile(mindarPath));
  const aframe = await fetchScriptBytes(AFRAME_UPSTREAM_SCRIPT_URL, "A-Frame");
  return [
    { key: AFRAME_RUNTIME_OBJECT_KEY, body: aframe },
    { key: MINDAR_RUNTIME_OBJECT_KEY, body: mindar }
  ];
}
