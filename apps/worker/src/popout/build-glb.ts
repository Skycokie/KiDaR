import * as THREE from "three";
import { Document, NodeIO } from "@gltf-transform/core";
import type { StickerPolygon } from "@kidar/core";

function makeExtrudedGeometry(polygon: StickerPolygon) {
  const shape = new THREE.Shape();
  polygon.points.forEach((point, index) => {
    const x = point.x * 2.7;
    const y = point.y * 2.7;
    if (index === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  });
  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.16,
    bevelEnabled: true,
    bevelSegments: 4,
    bevelSize: 0.035,
    bevelThickness: 0.04,
    curveSegments: 4
  });
  geometry.center();
  geometry.computeVertexNormals();
  return geometry;
}

function mergeGeometries(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
  if (geometries.length === 1) return geometries[0];
  // Manual merge keeps us free of the deprecated GeometryUtils package.
  const merged = new THREE.BufferGeometry();
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  let indexOffset = 0;

  for (const geometry of geometries) {
    const pos = geometry.getAttribute("position");
    const nor = geometry.getAttribute("normal");
    const uv = geometry.getAttribute("uv");
    const idx = geometry.getIndex();
    for (let i = 0; i < pos.count; i += 1) {
      positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      if (nor) normals.push(nor.getX(i), nor.getY(i), nor.getZ(i));
      else normals.push(0, 0, 1);
      if (uv) uvs.push(uv.getX(i), uv.getY(i));
      else uvs.push(0, 0);
    }
    if (idx) {
      for (let i = 0; i < idx.count; i += 1) indices.push(idx.getX(i) + indexOffset);
    } else {
      for (let i = 0; i < pos.count; i += 1) indices.push(i + indexOffset);
    }
    indexOffset += pos.count;
    geometry.dispose();
  }

  merged.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  merged.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  merged.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  merged.setIndex(indices);
  return merged;
}

/**
 * Headless ExtrudeGeometry → binary GLB via gltf-transform (no DOM canvas).
 * Transparent cutout texture is encoded as PNG with sharp.
 */
export async function buildPopoutGlb(input: {
  polygons: StickerPolygon[];
  width: number;
  height: number;
  rgba: Uint8ClampedArray;
  theme?: string;
}): Promise<Uint8Array> {
  if (!input.polygons.length) {
    throw new Error("No polygons to extrude");
  }

  const geometries = input.polygons.map((polygon) => makeExtrudedGeometry(polygon));
  const geometry = mergeGeometries(geometries);
  const position = geometry.getAttribute("position");
  const normal = geometry.getAttribute("normal");
  const uv = geometry.getAttribute("uv");
  let index = geometry.getIndex();
  if (!position) {
    throw new Error("Extruded geometry is missing position buffer");
  }
  if (!index) {
    const sequential = new Uint32Array(position.count);
    for (let i = 0; i < position.count; i += 1) sequential[i] = i;
    geometry.setIndex(Array.from(sequential));
    index = geometry.getIndex();
  }
  if (!index) {
    throw new Error("Extruded geometry is missing index buffer");
  }

  const { PNG } = await import("pngjs");
  const pngImage = new PNG({ width: input.width, height: input.height });
  pngImage.data = Buffer.from(input.rgba.buffer, input.rgba.byteOffset, input.rgba.byteLength);
  const png = PNG.sync.write(pngImage);

  const document = new Document();
  const buffer = document.createBuffer();
  const positionAccessor = document
    .createAccessor()
    .setType("VEC3")
    .setArray(new Float32Array(position.array as ArrayLike<number>))
    .setBuffer(buffer);
  const normalAccessor = document
    .createAccessor()
    .setType("VEC3")
    .setArray(new Float32Array((normal?.array as ArrayLike<number>) ?? []))
    .setBuffer(buffer);
  const uvAccessor = document
    .createAccessor()
    .setType("VEC2")
    .setArray(new Float32Array((uv?.array as ArrayLike<number>) ?? []))
    .setBuffer(buffer);
  const indicesAccessor = document
    .createAccessor()
    .setType("SCALAR")
    .setArray(new Uint32Array(index.array as ArrayLike<number>))
    .setBuffer(buffer);

  const texture = document
    .createTexture("popout")
    .setMimeType("image/png")
    .setImage(new Uint8Array(png));

  const accent = input.theme || "#6d5dfc";
  const material = document
    .createMaterial("popout")
    .setBaseColorTexture(texture)
    .setAlphaMode("MASK")
    .setAlphaCutoff(0.04)
    .setRoughnessFactor(0.52)
    .setMetallicFactor(0.02)
    .setBaseColorFactor([
      Number.parseInt(accent.slice(1, 3), 16) / 255 || 0.4,
      Number.parseInt(accent.slice(3, 5), 16) / 255 || 0.36,
      Number.parseInt(accent.slice(5, 7), 16) / 255 || 0.99,
      1
    ]);

  const primitive = document
    .createPrimitive()
    .setAttribute("POSITION", positionAccessor)
    .setAttribute("NORMAL", normalAccessor)
    .setAttribute("TEXCOORD_0", uvAccessor)
    .setIndices(indicesAccessor)
    .setMaterial(material);

  const mesh = document.createMesh("popout").addPrimitive(primitive);
  const node = document.createNode("popout").setMesh(mesh);
  document.createScene("popout").addChild(node);

  geometry.dispose();
  const io = new NodeIO();
  return io.writeBinary(document);
}

/** glTF magic bytes for a binary GLB container. */
export function isGlbBuffer(bytes: Uint8Array): boolean {
  return (
    bytes.byteLength >= 12 &&
    bytes[0] === 0x67 &&
    bytes[1] === 0x6c &&
    bytes[2] === 0x54 &&
    bytes[3] === 0x46
  );
}
