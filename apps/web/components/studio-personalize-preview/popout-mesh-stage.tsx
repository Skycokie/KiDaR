"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { type DepthScoredPolygon } from "@kidar/core";
import { useStudioI18n } from "@/components/i18n/studio-i18n";
import { disposePopoutObject, makePopoutComponentMesh } from "./popout-extrude-mesh";
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
  const { messages } = useStudioI18n();
  const COPY = messages.personalize;

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
        disposePopoutObject(child, shared);
      }
      const { depth } = previewVolumeDepth(volumeRef.current);
      const ordered = [...extract.layers].sort(
        (left, right) => left.z - right.z || right.polygon.area - left.polygon.area
      );
      for (const layer of ordered) {
        root.add(
          makePopoutComponentMesh(
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
      disposePopoutObject(root, shared);
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
