/**
 * Validate a provider GLB before accepting it as a public figurine artifact.
 */

import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import {
  FIGURINE_MAX_GLB_BYTES,
  FIGURINE_MAX_TRIANGLES,
  FIGURINE_MAX_VERTICES,
  FigurineBuildError
} from "@kidar/core";
import { isGlbBuffer } from "../popout/build-glb";

export type FigurineGlbValidation = {
  bytes: number;
  triangles: number;
  vertices: number;
  bboxSize: { x: number; y: number; z: number };
};

export async function validateFigurineGlb(raw: Uint8Array): Promise<FigurineGlbValidation> {
  if (!raw.byteLength) {
    throw new FigurineBuildError("Figurine GLB is empty", {
      retryable: false,
      code: "GLB_EMPTY"
    });
  }
  if (raw.byteLength > FIGURINE_MAX_GLB_BYTES) {
    throw new FigurineBuildError("Figurine GLB exceeds maximum size", {
      retryable: false,
      code: "GLB_TOO_LARGE"
    });
  }
  if (!isGlbBuffer(raw)) {
    throw new FigurineBuildError("Download is not a valid GLB", {
      retryable: false,
      code: "GLB_MAGIC"
    });
  }

  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  let document;
  try {
    document = await io.readBinary(raw);
  } catch (error) {
    throw new FigurineBuildError(
      `Figurine GLB parse failed: ${error instanceof Error ? error.message : "invalid"}`,
      { retryable: false, code: "GLB_PARSE" }
    );
  }

  let triangles = 0;
  let vertices = 0;
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;

  for (const mesh of document.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute("POSITION");
      if (pos) {
        vertices += pos.getCount();
        const el: [number, number, number] = [0, 0, 0];
        for (let i = 0; i < pos.getCount(); i += 1) {
          pos.getElement(i, el);
          const [x, y, z] = el;
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (z < minZ) minZ = z;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
          if (z > maxZ) maxZ = z;
        }
      }
      const indices = prim.getIndices();
      if (indices) {
        triangles += Math.floor(indices.getCount() / 3);
      } else if (pos) {
        triangles += Math.floor(pos.getCount() / 3);
      }
    }
  }

  if (vertices <= 0 || triangles <= 0) {
    throw new FigurineBuildError("Figurine GLB has no mesh geometry", {
      retryable: false,
      code: "GLB_EMPTY_MESH"
    });
  }
  if (triangles > FIGURINE_MAX_TRIANGLES || vertices > FIGURINE_MAX_VERTICES) {
    throw new FigurineBuildError("Figurine GLB exceeds mobile geometry budget", {
      retryable: false,
      code: "GLB_TOO_COMPLEX"
    });
  }

  const sizeX = maxX - minX;
  const sizeY = maxY - minY;
  const sizeZ = maxZ - minZ;
  if (
    !Number.isFinite(sizeX) ||
    !Number.isFinite(sizeY) ||
    !Number.isFinite(sizeZ) ||
    sizeX <= 0 ||
    sizeY <= 0 ||
    sizeZ <= 0
  ) {
    throw new FigurineBuildError("Figurine GLB bounding box is invalid", {
      retryable: false,
      code: "GLB_BOUNDS"
    });
  }

  return {
    bytes: raw.byteLength,
    triangles,
    vertices,
    bboxSize: { x: sizeX, y: sizeY, z: sizeZ }
  };
}
