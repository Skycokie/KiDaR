import * as THREE from "three";
import {
  POPOUT_EXTRUDE,
  POPOUT_SHAPE_SCALE,
  buildEdgeStripRgba,
  medianRgb,
  popoutCapUv,
  rgbToHex,
  sampleInwardEdgeColors,
  type StickerPolygon
} from "@kidar/core";

export function applyPopoutCapUvs(geometry: THREE.BufferGeometry) {
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

export function disposePopoutObject(object: THREE.Object3D, shared?: Set<THREE.Texture>) {
  object.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry?.dispose();
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      const map = (material as THREE.MeshStandardMaterial).map;
      if (map && !shared?.has(map)) map.dispose();
      material.dispose();
    }
  });
}

/** Same ExtrudeGeometry paper lift as Studio Personaj pop-out. */
export function makePopoutComponentMesh(
  polygon: StickerPolygon,
  faceTexture: THREE.CanvasTexture,
  width: number,
  height: number,
  rgba: Uint8ClampedArray,
  depth: number,
  z: number,
  shadows: boolean
) {
  const shape = new THREE.Shape();
  polygon.points.forEach((point, index) => {
    const x = point.x * POPOUT_SHAPE_SCALE;
    const y = point.y * POPOUT_SHAPE_SCALE;
    if (index === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  });
  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, {
    ...POPOUT_EXTRUDE,
    depth
  });
  applyPopoutCapUvs(geometry);
  geometry.computeVertexNormals();
  if (z !== 0) geometry.translate(0, 0, z);

  const colors = sampleInwardEdgeColors(width, height, rgba, polygon.points, {
    inwardPx: Math.max(3, Math.round(Math.min(width, height) / 180)),
    maxSamples: 160
  });
  const fallbackHex = rgbToHex(medianRgb(colors));
  const strip = buildEdgeStripRgba(colors.length ? colors : [medianRgb([])], 8);
  const edgeMap = new THREE.DataTexture(strip.data, strip.width, strip.height, THREE.RGBAFormat);
  edgeMap.colorSpace = THREE.SRGBColorSpace;
  edgeMap.wrapS = THREE.ClampToEdgeWrapping;
  edgeMap.wrapT = THREE.ClampToEdgeWrapping;
  edgeMap.magFilter = THREE.LinearFilter;
  edgeMap.minFilter = THREE.LinearFilter;
  edgeMap.needsUpdate = true;

  const front = new THREE.MeshStandardMaterial({
    map: faceTexture,
    transparent: true,
    alphaTest: 0.04,
    roughness: 0.62,
    metalness: 0,
    side: THREE.FrontSide
  });
  const side = new THREE.MeshStandardMaterial({
    map: edgeMap,
    color: fallbackHex,
    roughness: 0.78,
    metalness: 0
  });
  const mesh = new THREE.Mesh(geometry, [front, side]);
  mesh.castShadow = shadows;
  mesh.receiveShadow = shadows;
  return mesh;
}
