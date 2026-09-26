"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import {
  POPOUT_EXTRUDE,
  POPOUT_SHAPE_SCALE,
  buildEdgeStripRgba,
  medianRgb,
  popoutCapUv,
  rgbToHex,
  sampleInwardEdgeColors,
  type DepthScoredPolygon,
  type StickerPolygon
} from "@kidar/core";
import { COPY } from "./fixtures";
import { createPreviewCutout } from "./popout-preview-cutout";
import {
  decidePreviewPopout,
  previewLayerZ,
  previewVolumeDepth
} from "./popout-preview-normalize";

type ReadyExtract = {
  sourceCanvas: HTMLCanvasElement;
  cutoutCanvas: HTMLCanvasElement;
  rgba: Uint8ClampedArray;
  width: number;
  height: number;
  layers: DepthScoredPolygon[];
};

/** In-memory for this page session only. Not persisted. */
const sessionExtracts = new Map<string, ReadyExtract>();

type Phase = "preparing" | "ready" | "fallback";

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

function disposeObject(object: THREE.Object3D, shared?: Set<THREE.Texture>) {
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

function makeComponentMesh(
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
  applyCapUvs(geometry);
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

export function PopoutMeshStage({
  sourceUrl,
  volume,
  yaw,
  pitch,
  roll,
  zoom
}: {
  sourceUrl: string;
  volume: number;
  yaw: number;
  pitch: number;
  roll: number;
  zoom: number;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const extractRef = useRef<ReadyExtract | null>(null);
  const [phase, setPhase] = useState<Phase>("preparing");
  const [retryToken, setRetryToken] = useState(0);
  const [layerSummary, setLayerSummary] = useState<{ count: number; minZ: number; maxZ: number } | null>(
    null
  );
  const volumeRef = useRef(volume);
  const viewRef = useRef({ yaw, pitch, roll, zoom });
  volumeRef.current = volume;
  viewRef.current = { yaw, pitch, roll, zoom };

  useEffect(() => {
    let cancelled = false;
    setPhase("preparing");
    setLayerSummary(null);
    const cached = retryToken === 0 ? sessionExtracts.get(sourceUrl) : undefined;
    if (retryToken > 0) sessionExtracts.delete(sourceUrl);

    void (async () => {
      try {
        const ready =
          cached ??
          (await (async () => {
            const cutout = await createPreviewCutout(sourceUrl);
            const decision = decidePreviewPopout(cutout.polygons, cutout.stats.coverage);
            if (decision.kind !== "layers") return null;
            const next: ReadyExtract = {
              sourceCanvas: cutout.sourceCanvas,
              cutoutCanvas: cutout.cutoutCanvas,
              rgba: cutout.rgba,
              width: cutout.cutoutCanvas.width,
              height: cutout.cutoutCanvas.height,
              layers: decision.layers
            };
            sessionExtracts.set(sourceUrl, next);
            return next;
          })());
        if (cancelled) return;
        if (!ready) {
          extractRef.current = null;
          setLayerSummary(null);
          setPhase("fallback");
          return;
        }
        extractRef.current = ready;
        const zs = ready.layers.map((layer) => layer.z);
        setLayerSummary({
          count: ready.layers.length,
          minZ: Math.min(...zs),
          maxZ: Math.max(...zs)
        });
        setPhase("ready");
      } catch {
        if (!cancelled) {
          extractRef.current = null;
          setLayerSummary(null);
          setPhase("fallback");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sourceUrl, retryToken]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || phase !== "ready" || !extractRef.current) return;
    const extract = extractRef.current;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const mobile = window.matchMedia("(max-width: 959px)").matches;
    const lite = mobile || (navigator.hardwareConcurrency || 8) <= 4;
    const renderer = new THREE.WebGLRenderer({ antialias: !reducedMotion, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2));
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = !lite;
    if (!lite) renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.05, 40);
    const root = new THREE.Group();
    scene.add(root);

    const key = new THREE.DirectionalLight(0xfff2df, 1.35);
    key.position.set(1.4, 2.2, 3.2);
    if (!lite) {
      key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      key.shadow.camera.near = 0.2;
      key.shadow.camera.far = 12;
      key.shadow.bias = -0.0008;
      const shadowCam = key.shadow.camera as THREE.OrthographicCamera;
      shadowCam.left = -4;
      shadowCam.right = 4;
      shadowCam.top = 4;
      shadowCam.bottom = -4;
      shadowCam.updateProjectionMatrix();
    }
    scene.add(key);
    scene.add(new THREE.AmbientLight(0xffe6cc, 0.42));
    const rim = new THREE.DirectionalLight(0xffd7b0, 0.55);
    rim.position.set(-2.2, 1.1, -1.4);
    scene.add(rim);

    const faceTexture = new THREE.CanvasTexture(extract.cutoutCanvas);
    faceTexture.colorSpace = THREE.SRGBColorSpace;
    faceTexture.flipY = true;
    const shared = new Set<THREE.Texture>([faceTexture]);

    const focus = new THREE.Vector3();

    const rebuild = () => {
      for (const child of [...root.children]) {
        root.remove(child);
        disposeObject(child, shared);
      }
      const { depth } = previewVolumeDepth(volumeRef.current);
      const ordered = [...extract.layers].sort(
        (left, right) => left.z - right.z || right.polygon.area - left.polygon.area
      );
      for (const layer of ordered) {
        root.add(
          makeComponentMesh(
            layer.polygon,
            faceTexture,
            extract.width,
            extract.height,
            extract.rgba,
            depth,
            previewLayerZ(layer.z, volumeRef.current),
            !lite
          )
        );
      }
      root.updateMatrixWorld(true);
      const box = new THREE.Box3();
      for (const child of root.children) box.expandByObject(child);
      if (!box.isEmpty()) {
        const center = box.getCenter(new THREE.Vector3());
        for (const child of root.children) {
          child.position.x -= center.x;
          child.position.y -= center.y;
          child.position.z -= center.z;
        }
      }
    };

    const frameCamera = () => {
      const { yaw: yawDeg, pitch: pitchDeg, roll: rollDeg, zoom: zoomPct } = viewRef.current;
      const radius = 5.4 / Math.max(0.45, zoomPct / 100);
      // Fixed camera; object rotation matches CSS rotateY/rotateX/rotateZ (Three YXZ).
      camera.position.set(focus.x, focus.y, focus.z + radius);
      camera.up.set(0, 1, 0);
      camera.lookAt(focus);
      root.rotation.order = "YXZ";
      root.rotation.set(
        THREE.MathUtils.degToRad(pitchDeg),
        THREE.MathUtils.degToRad(yawDeg),
        THREE.MathUtils.degToRad(rollDeg)
      );
    };

    const resize = () => {
      const width = Math.max(1, mount.clientWidth);
      const height = Math.max(1, mount.clientHeight);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };

    rebuild();
    resize();
    frameCamera();

    const observer = new ResizeObserver(() => {
      resize();
    });
    observer.observe(mount);

    let frame = 0;
    let lastVolume = volumeRef.current;
    const loop = () => {
      if (volumeRef.current !== lastVolume) {
        lastVolume = volumeRef.current;
        rebuild();
      }
      frameCamera();
      renderer.render(scene, camera);
      frame = window.requestAnimationFrame(loop);
    };
    frame = window.requestAnimationFrame(loop);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      disposeObject(root, shared);
      for (const texture of shared) texture.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [phase, sourceUrl, retryToken]);

  return (
    <div
      className="studio-stage__popout-live"
      data-popout-phase={phase}
      data-popout-layers={layerSummary?.count ?? 0}
      data-popout-z-min={layerSummary?.minZ ?? ""}
      data-popout-z-max={layerSummary?.maxZ ?? ""}
    >
      <div ref={mountRef} className="studio-stage__popout-canvas" />
      {phase === "fallback" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={sourceUrl} alt="" className="studio-stage__popout-flat" draggable={false} />
      ) : null}
      {phase === "preparing" ? (
        <p className="studio-stage__popout-status" role="status">
          {COPY.popoutPreparing}
        </p>
      ) : null}
      {phase === "fallback" ? (
        <div className="studio-stage__popout-status" role="alert">
          <p>{COPY.popoutSeparateFailed}</p>
          <button type="button" className="studio-stage__popout-retry" onClick={() => setRetryToken((value) => value + 1)}>
            {COPY.popoutRetry}
          </button>
        </div>
      ) : null}
    </div>
  );
}
