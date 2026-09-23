"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  POPOUT_EXTRUDE,
  POPOUT_SHAPE_SCALE,
  alphaMaskFromRgba,
  assignPopoutDepthLayers,
  buildEdgeStripRgba,
  extractSilhouettePolygons,
  getSilhouetteStats,
  medianRgb,
  popoutCapUv,
  rgbToHex,
  sampleInwardEdgeColors,
  type StickerPolygon
} from "@kidar/core";
import type { ProjectSettings } from "@kidar/core";

type PreviewMode = "popout" | "gallery" | "upload" | "figurine_3d";

async function createCutout(sourceUrl: string) {
  // Pin WASM to an absolute CDN prefix so Next's RelativeURL shim never sees
  // a relative `import.meta.url` path (that path throws url.replace errors).
  const ort = (await import("onnxruntime-web")) as {
    env: { wasm: { wasmPaths: string } };
    default?: { env: { wasm: { wasmPaths: string } } };
  };
  const runtime = ort.default ?? ort;
  runtime.env.wasm.wasmPaths =
    "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.21.0/dist/";
  const { removeBackground } = await import("@imgly/background-removal");
  const sourceResponse = await fetch(sourceUrl);
  if (!sourceResponse.ok) throw new Error("Could not load source drawing");
  const sourceBlob = await sourceResponse.blob();
  const typedBlob =
    sourceBlob.type && sourceBlob.type !== "application/octet-stream"
      ? sourceBlob
      : new Blob([sourceBlob], { type: "image/jpeg" });
  const cutoutBlob = await removeBackground(typedBlob, {
    publicPath:
      "https://staticimgly.com/@imgly/background-removal-data/1.7.0/dist/"
  });
  const bitmap = await createImageBitmap(cutoutBlob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D context is unavailable");
  context.drawImage(bitmap, 0, 0);
  bitmap.close();

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const mask = alphaMaskFromRgba(canvas.width, canvas.height, imageData.data);
  // Finer contours + slightly stronger cleanup help separate weakly-touching subjects.
  const polygons = extractSilhouettePolygons(mask, {
    cleanupRadius: Math.max(1, Math.round(Math.min(canvas.width, canvas.height) / 700)),
    simplifyEpsilon: 0.0035,
    minComponentPixels: Math.max(10, Math.floor(canvas.width * canvas.height * 0.00012))
  });
  if (!polygons.length) throw new Error("No foreground silhouette was detected");
  const stats = getSilhouetteStats(mask, polygons);
  if (stats.coverage >= 0.9) {
    throw new Error("Foreground mask covers almost the whole image; refusing full-rectangle extrusion");
  }
  return { canvas, imageData, polygons, stats };
}

/** Cap UVs only — leave ExtrudeGeometry side UVs for the edge strip. */
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

function edgeTextureFromPolygon(
  polygon: StickerPolygon,
  width: number,
  height: number,
  rgba: Uint8ClampedArray
): { texture: THREE.DataTexture; fallbackHex: string } {
  const colors = sampleInwardEdgeColors(width, height, rgba, polygon.points, {
    inwardPx: Math.max(3, Math.round(Math.min(width, height) / 180)),
    maxSamples: 160
  });
  const fallbackHex = rgbToHex(medianRgb(colors));
  const strip = buildEdgeStripRgba(colors.length ? colors : [medianRgb([])], 8);
  const texture = new THREE.DataTexture(strip.data, strip.width, strip.height, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return { texture, fallbackHex };
}

function makeExtrudedSticker(
  polygon: StickerPolygon,
  faceTexture: THREE.CanvasTexture,
  width: number,
  height: number,
  rgba: Uint8ClampedArray,
  zOffset = 0
) {
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
  geometry.computeVertexNormals();
  geometry.center();
  if (zOffset !== 0) geometry.translate(0, 0, zOffset);

  const { texture: edgeMap, fallbackHex } = edgeTextureFromPolygon(polygon, width, height, rgba);

  const front = new THREE.MeshStandardMaterial({
    map: faceTexture,
    transparent: true,
    alphaTest: 0.04,
    roughness: 0.55,
    metalness: 0
  });
  const side = new THREE.MeshStandardMaterial({
    map: edgeMap,
    color: fallbackHex,
    roughness: 0.7,
    metalness: 0
  });
  const mesh = new THREE.Mesh(geometry, [front, side]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

type SceneHandle = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  root: THREE.Group;
  backdrop: THREE.Group;
  ground: THREE.Mesh;
  hemi: THREE.HemisphereLight;
  key: THREE.DirectionalLight;
  fill: THREE.DirectionalLight;
  ambient: THREE.AmbientLight;
  rim: THREE.DirectionalLight;
};

function clearGroup(group: THREE.Group) {
  while (group.children.length > 0) {
    const child = group.children[0]!;
    group.remove(child);
    child.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.geometry?.dispose();
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const material of materials) {
          const map = (material as THREE.MeshBasicMaterial).map;
          map?.dispose();
          material.dispose();
        }
      }
    });
  }
}

function applyFigurineLighting(handle: SceneHandle, isFigurine: boolean) {
  handle.hemi.intensity = isFigurine ? 0.75 : 0.55;
  handle.key.intensity = isFigurine ? 1.2 : 1.35;
  handle.fill.intensity = isFigurine ? 0.65 : 0.35;
  handle.fill.position.set(isFigurine ? -3 : -2.2, isFigurine ? 2 : 1.2, isFigurine ? -2 : 1.5);
  handle.ambient.intensity = isFigurine ? 0.55 : 0;
  handle.rim.intensity = isFigurine ? 0.35 : 0;
  handle.ground.position.y = isFigurine ? 0 : -0.85;
  (handle.ground.material as THREE.ShadowMaterial).opacity = isFigurine ? 0.12 : 0.18;
}

function groundFigurineModel(scene: THREE.Object3D) {
  const box0 = new THREE.Box3().setFromObject(scene);
  const size0 = box0.getSize(new THREE.Vector3());
  const maxDim = Math.max(size0.x, size0.y, size0.z, 0.01);
  scene.scale.setScalar(1.6 / maxDim);

  const box = new THREE.Box3().setFromObject(scene);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  scene.position.x = -center.x;
  scene.position.z = -center.z;
  scene.position.y = -box.min.y;

  scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
  });

  return size;
}

function makeContactShadow(size: THREE.Vector3) {
  const shadowSize = Math.max(size.x, size.z) * 1.25;
  const shadowCanvas = document.createElement("canvas");
  shadowCanvas.width = 128;
  shadowCanvas.height = 128;
  const ctx = shadowCanvas.getContext("2d");
  if (ctx) {
    const g = ctx.createRadialGradient(64, 64, 8, 64, 64, 62);
    g.addColorStop(0, "rgba(20,16,28,0.45)");
    g.addColorStop(0.55, "rgba(20,16,28,0.18)");
    g.addColorStop(1, "rgba(20,16,28,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  }
  const shadowMap = new THREE.CanvasTexture(shadowCanvas);
  const shadowPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(shadowSize, shadowSize),
    new THREE.MeshBasicMaterial({
      map: shadowMap,
      transparent: true,
      opacity: 0.9,
      depthWrite: false
    })
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = 0.002;
  shadowPlane.renderOrder = -1;
  return shadowPlane;
}

export function ThreePreview({
  sourceUrl,
  mode,
  settings,
  onPopoutStats
}: {
  sourceUrl: string | null;
  mode: PreviewMode;
  settings: ProjectSettings;
  onPopoutStats?: (stats: ReturnType<typeof getSilhouetteStats>) => void;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<SceneHandle | null>(null);
  const lastContentKeyRef = useRef<string | null>(null);
  const onPopoutStatsRef = useRef(onPopoutStats);
  onPopoutStatsRef.current = onPopoutStats;

  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const modelUrl =
    mode === "gallery"
      ? settings.galleryModelUrl ?? null
      : mode === "figurine_3d"
        ? settings.figurineModelUrl ?? null
        : settings.uploadModelUrl ?? null;

  const contentKey =
    mode === "popout"
      ? `popout:${sourceUrl ?? ""}`
      : mode === "figurine_3d"
        ? `figurine:${modelUrl ?? ""}`
        : mode === "gallery"
          ? `gallery:${modelUrl ?? ""}:${sourceUrl ?? ""}`
          : `upload:${modelUrl ?? ""}:${sourceUrl ?? ""}`;

  // Mount renderer / camera / controls once — never tear down on poll/autosave.
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
    camera.position.set(1.55, 1.05, 3.35);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 0.05, 0);
    controls.update();

    const hemi = new THREE.HemisphereLight("#fff8f0", "#3d3830", 0.55);
    scene.add(hemi);
    const key = new THREE.DirectionalLight("#fff4e6", 1.35);
    key.position.set(2.4, 3.8, 2.8);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    scene.add(key);
    const fill = new THREE.DirectionalLight("#eaeeff", 0.35);
    fill.position.set(-2.2, 1.2, 1.5);
    scene.add(fill);
    const ambient = new THREE.AmbientLight(0xffffff, 0);
    scene.add(ambient);
    const rim = new THREE.DirectionalLight("#fff8f0", 0);
    rim.position.set(0.5, 1.5, -3);
    scene.add(rim);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(8, 8),
      new THREE.ShadowMaterial({ opacity: 0.18 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.85;
    ground.receiveShadow = true;
    scene.add(ground);

    const backdrop = new THREE.Group();
    scene.add(backdrop);
    const root = new THREE.Group();
    scene.add(root);

    handleRef.current = {
      scene,
      camera,
      controls,
      root,
      backdrop,
      ground,
      hemi,
      key,
      fill,
      ambient,
      rim
    };

    const resize = () => {
      const width = mount.clientWidth || 640;
      const height = mount.clientHeight || 480;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(mount);

    let frame = 0;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      renderer.dispose();
      clearGroup(root);
      clearGroup(backdrop);
      handleRef.current = null;
      lastContentKeyRef.current = null;
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Offset / scale can change without remounting the scene or resetting orbit.
  useEffect(() => {
    const handle = handleRef.current;
    if (!handle) return;
    handle.root.position.set(settings.offset.x, settings.offset.y, settings.offset.z);
    handle.root.scale.setScalar(settings.scale);
  }, [settings.offset.x, settings.offset.y, settings.offset.z, settings.scale]);

  // Reload mesh / popout only when mode or model/source URL actually changes.
  useEffect(() => {
    const handle = handleRef.current;
    if (!handle) return;
    if (contentKey === lastContentKeyRef.current) return;
    lastContentKeyRef.current = contentKey;

    let cancelled = false;
    const { camera, controls, root, backdrop } = handle;
    clearGroup(root);
    clearGroup(backdrop);
    applyFigurineLighting(handle, mode === "figurine_3d");
    setError(null);

    if (mode === "figurine_3d") {
      controls.target.set(0, 0.55, 0);
      controls.update();
    } else {
      controls.target.set(0, 0.05, 0);
      controls.update();
    }

    if (mode === "popout") {
      if (!sourceUrl) return;
      setProcessing(true);
      void (async () => {
        try {
          const { canvas, imageData, polygons, stats } = await createCutout(sourceUrl);
          if (cancelled) return;
          onPopoutStatsRef.current?.(stats);
          const texture = new THREE.CanvasTexture(canvas);
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.flipY = true;
          const layers = assignPopoutDepthLayers(polygons);
          layers.forEach(({ polygon, z }) => {
            root.add(
              makeExtrudedSticker(
                polygon,
                texture,
                canvas.width,
                canvas.height,
                imageData.data,
                z
              )
            );
          });
          setProcessing(false);
        } catch (cause) {
          if (!cancelled) {
            setProcessing(false);
            setError(cause instanceof Error ? cause.message : "Could not create sticker silhouette");
          }
        }
      })();
      return () => {
        cancelled = true;
      };
    }

    // Gallery / upload: faint source plane. Figurine: never show 2D ghost.
    if (mode !== "figurine_3d" && sourceUrl) {
      const textureLoader = new THREE.TextureLoader();
      const baseTexture = textureLoader.load(sourceUrl);
      baseTexture.colorSpace = THREE.SRGBColorSpace;
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(2.6, 2.6),
        new THREE.MeshBasicMaterial({ map: baseTexture, transparent: true, opacity: 0.28 })
      );
      plane.position.z = -0.2;
      backdrop.add(plane);
    }

    if (!modelUrl) return;

    const loader = new GLTFLoader();
    loader.load(
      modelUrl,
      (gltf) => {
        if (cancelled) return;

        if (mode === "figurine_3d") {
          const size = groundFigurineModel(gltf.scene);
          root.add(makeContactShadow(size));
          root.add(gltf.scene);
          // Frame only on first load of this URL — orbit stays user-controlled after that.
          camera.position.set(2.1, 1.15, 2.35);
          controls.target.set(0, size.y * 0.42, 0);
          controls.update();
          return;
        }

        const box = new THREE.Box3().setFromObject(gltf.scene);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z, 0.01);
        gltf.scene.scale.setScalar(1.6 / maxDim);
        box.setFromObject(gltf.scene);
        const center = box.getCenter(new THREE.Vector3());
        gltf.scene.position.sub(center);
        gltf.scene.position.y += 0.2;
        root.add(gltf.scene);
      },
      undefined,
      () => undefined
    );

    return () => {
      cancelled = true;
    };
  }, [contentKey, mode, modelUrl, sourceUrl]);

  const isFigurine = mode === "figurine_3d";

  return (
    <div
      ref={mountRef}
      style={
        isFigurine
          ? {
              minHeight: "80vh",
              width: "100%",
              position: "relative",
              overflow: "hidden",
              background:
                "linear-gradient(180deg, #1c1b1f 0%, #141316 55%, #0e0d10 100%)"
            }
          : {
              minHeight: 420,
              width: "100%",
              position: "relative",
              backgroundColor: "#f4f1ff",
              backgroundImage:
                "linear-gradient(45deg, #e9e4fb 25%, transparent 25%), linear-gradient(-45deg, #e9e4fb 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e9e4fb 75%), linear-gradient(-45deg, transparent 75%, #e9e4fb 75%)",
              backgroundSize: "24px 24px",
              backgroundPosition: "0 0, 0 12px, 12px -12px, -12px 0"
            }
      }
    >
      {!sourceUrl && !isFigurine && <p>Upload a drawing to preview the AR scene.</p>}
      {processing && (
        <p
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            color: isFigurine ? "#f5f0e8" : undefined
          }}
        >
          Cutting out foreground…
        </p>
      )}
      {error && (
        <p
          role="alert"
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            color: isFigurine ? "#ffb4a8" : undefined
          }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
