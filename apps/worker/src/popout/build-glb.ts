import * as THREE from "three";
import { Document, NodeIO } from "@gltf-transform/core";
import {
  POPOUT_EXTRUDE,
  POPOUT_SHAPE_SCALE,
  assignPopoutDepthLayers,
  buildEdgeStripRgba,
  medianRgb,
  popoutCapUv,
  sampleInwardEdgeColors,
  type StickerPolygon
} from "@kidar/core";

/** Cap UVs only — preserve ExtrudeGeometry side UVs for the edge strip. */
function applyCapUvs(geometry: THREE.BufferGeometry) {
  const position = geometry.getAttribute("position");
  const uv = geometry.getAttribute("uv");
  if (!position || !uv) return;
  const groups = geometry.groups.length
    ? geometry.groups
    : [{ start: 0, count: geometry.index?.count ?? position.count, materialIndex: 0 }];
  const index = geometry.getIndex();

  for (const group of groups) {
    if (group.materialIndex !== 0) continue;
    const seen = new Set<number>();
    if (index) {
      for (let i = group.start; i < group.start + group.count; i += 1) {
        const vertex = index.getX(i);
        if (seen.has(vertex)) continue;
        seen.add(vertex);
        const mapped = popoutCapUv(position.getX(vertex), position.getY(vertex));
        uv.setXY(vertex, mapped.u, mapped.v);
      }
    } else {
      for (let i = group.start; i < group.start + group.count; i += 1) {
        if (seen.has(i)) continue;
        seen.add(i);
        const mapped = popoutCapUv(position.getX(i), position.getY(i));
        uv.setXY(i, mapped.u, mapped.v);
      }
    }
  }
  uv.needsUpdate = true;
}

function makeExtrudedGeometry(polygon: StickerPolygon, zOffset = 0) {
  const shape = new THREE.Shape();
  polygon.points.forEach((point, index) => {
    const x = point.x * POPOUT_SHAPE_SCALE;
    const y = point.y * POPOUT_SHAPE_SCALE;
    if (index === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  });
  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, { ...POPOUT_EXTRUDE });
  applyCapUvs(geometry);
  geometry.center();
  if (zOffset !== 0) geometry.translate(0, 0, zOffset);
  geometry.computeVertexNormals();
  return geometry;
}

function extractGroupGeometry(
  geometry: THREE.BufferGeometry,
  materialIndex: number
): THREE.BufferGeometry | null {
  const group = geometry.groups.find((item) => item.materialIndex === materialIndex);
  if (!group || group.count <= 0) return null;
  const position = geometry.getAttribute("position");
  const normal = geometry.getAttribute("normal");
  const uv = geometry.getAttribute("uv");
  if (!position) return null;

  const index = geometry.getIndex();
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const remap = new Map<number, number>();

  const pushVertex = (src: number) => {
    let dst = remap.get(src);
    if (dst === undefined) {
      dst = remap.size;
      remap.set(src, dst);
      positions.push(position.getX(src), position.getY(src), position.getZ(src));
      if (normal) normals.push(normal.getX(src), normal.getY(src), normal.getZ(src));
      else normals.push(0, 0, 1);
      if (uv) uvs.push(uv.getX(src), uv.getY(src));
      else uvs.push(0, 0);
    }
    indices.push(dst);
  };

  if (index) {
    for (let i = group.start; i < group.start + group.count; i += 1) {
      pushVertex(index.getX(i));
    }
  } else {
    // ExtrudeGeometry is often non-indexed; groups address sequential vertices.
    for (let i = group.start; i < group.start + group.count; i += 1) {
      pushVertex(i);
    }
  }

  if (!indices.length) return null;
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  out.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  out.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  out.setIndex(indices);
  return out;
}

function mergeGeometries(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
  if (geometries.length === 1) return geometries[0];
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

function appendPrimitive(
  document: Document,
  buffer: ReturnType<Document["createBuffer"]>,
  mesh: ReturnType<Document["createMesh"]>,
  geometry: THREE.BufferGeometry,
  material: ReturnType<Document["createMaterial"]>
) {
  const position = geometry.getAttribute("position");
  const normal = geometry.getAttribute("normal");
  const uv = geometry.getAttribute("uv");
  let index = geometry.getIndex();
  if (!position) throw new Error("Missing position buffer");
  if (!index) {
    const sequential = new Uint32Array(position.count);
    for (let i = 0; i < position.count; i += 1) sequential[i] = i;
    geometry.setIndex(Array.from(sequential));
    index = geometry.getIndex();
  }
  if (!index) throw new Error("Missing index buffer");

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

  mesh.addPrimitive(
    document
      .createPrimitive()
      .setAttribute("POSITION", positionAccessor)
      .setAttribute("NORMAL", normalAccessor)
      .setAttribute("TEXCOORD_0", uvAccessor)
      .setIndices(indicesAccessor)
      .setMaterial(material)
  );
}

/**
 * Headless ExtrudeGeometry → binary GLB via gltf-transform (no DOM canvas).
 * Caps use the cutout PNG; sides use a local edge-color strip (no theme blue).
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

  const layers = assignPopoutDepthLayers(input.polygons);
  const extruded = layers.map(({ polygon, z }) => makeExtrudedGeometry(polygon, z));
  const edgeSourcePolygons = layers.map((item) => item.polygon);
  const capParts = extruded
    .map((geometry) => extractGroupGeometry(geometry, 0))
    .filter((item): item is THREE.BufferGeometry => Boolean(item));
  const sideParts = extruded
    .map((geometry) => extractGroupGeometry(geometry, 1))
    .filter((item): item is THREE.BufferGeometry => Boolean(item));

  if (!capParts.length) {
    throw new Error("Extruded geometry is missing cap faces");
  }

  const edgeColors = edgeSourcePolygons.flatMap((polygon) =>
    sampleInwardEdgeColors(input.width, input.height, input.rgba, polygon.points, {
      inwardPx: Math.max(3, Math.round(Math.min(input.width, input.height) / 180)),
      maxSamples: 96
    })
  );
  const edgeMedian = medianRgb(edgeColors);
  const strip = buildEdgeStripRgba(edgeColors.length ? edgeColors : [edgeMedian], 8);

  const { PNG } = await import("pngjs");
  const facePng = new PNG({ width: input.width, height: input.height });
  facePng.data = Buffer.from(input.rgba.buffer, input.rgba.byteOffset, input.rgba.byteLength);
  const faceBytes = PNG.sync.write(facePng);

  const edgePng = new PNG({ width: strip.width, height: strip.height });
  edgePng.data = Buffer.from(strip.data.buffer, strip.data.byteOffset, strip.data.byteLength);
  const edgeBytes = PNG.sync.write(edgePng);

  const document = new Document();
  const buffer = document.createBuffer();
  const faceTexture = document
    .createTexture("popout-face")
    .setMimeType("image/png")
    .setImage(new Uint8Array(faceBytes));
  const edgeTexture = document
    .createTexture("popout-edge")
    .setMimeType("image/png")
    .setImage(new Uint8Array(edgeBytes));

  // White factor — never multiply the drawing by a theme accent.
  const faceMaterial = document
    .createMaterial("popout-face")
    .setBaseColorTexture(faceTexture)
    .setAlphaMode("MASK")
    .setAlphaCutoff(0.04)
    .setRoughnessFactor(0.55)
    .setMetallicFactor(0)
    .setBaseColorFactor([1, 1, 1, 1]);

  const sideMaterial = document
    .createMaterial("popout-edge")
    .setBaseColorTexture(edgeTexture)
    .setRoughnessFactor(0.7)
    .setMetallicFactor(0)
    .setBaseColorFactor([
      edgeMedian.r / 255,
      edgeMedian.g / 255,
      edgeMedian.b / 255,
      1
    ]);

  const mesh = document.createMesh("popout");
  appendPrimitive(document, buffer, mesh, mergeGeometries(capParts), faceMaterial);
  if (sideParts.length) {
    appendPrimitive(document, buffer, mesh, mergeGeometries(sideParts), sideMaterial);
  }

  const node = document.createNode("popout").setMesh(mesh);
  document.createScene("popout").addChild(node);

  for (const geometry of extruded) geometry.dispose();
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
