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
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
    // ~30° side / ~18° above so thickness reads immediately.
    camera.position.set(1.55, 1.05, 3.35);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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
    const fill = new THREE.DirectionalLight("#d8e4ff", 0.35);
    fill.position.set(-2.2, 1.2, 1.5);
    scene.add(fill);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(8, 8),
      new THREE.ShadowMaterial({ opacity: 0.18 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.85;
    ground.receiveShadow = true;
    scene.add(ground);

    const root = new THREE.Group();
    root.position.set(settings.offset.x, settings.offset.y, settings.offset.z);
    root.scale.setScalar(settings.scale);
    scene.add(root);

    let disposed = false;
    const textureLoader = new THREE.TextureLoader();
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

    const addPopout = async () => {
      if (!sourceUrl) return;
      setProcessing(true);
      setError(null);
      try {
        const { canvas, imageData, polygons, stats } = await createCutout(sourceUrl);
        if (disposed) return;
        onPopoutStats?.(stats);
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        // Default flipY=true: v=0 is the canvas bottom. popoutCapUv uses the same
        // convention as glTF (v=0 = image bottom). Do not set flipY=false here.
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
        if (!disposed) {
          setProcessing(false);
          setError(cause instanceof Error ? cause.message : "Could not create sticker silhouette");
        }
      }
    };

    const addModel = () => {
      const modelUrl =
        mode === "gallery"
          ? settings.galleryModelUrl
          : mode === "figurine_3d"
            ? settings.figurineModelUrl
            : settings.uploadModelUrl;
      if (!modelUrl) return;
      new GLTFLoader().load(
        modelUrl,
        (gltf) => {
          if (!disposed) {
            // Frame the figurine with a slight orbit so volume is visible.
            const box = new THREE.Box3().setFromObject(gltf.scene);
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z, 0.01);
            const scale = 1.6 / maxDim;
            gltf.scene.scale.setScalar(scale);
            box.setFromObject(gltf.scene);
            const center = box.getCenter(new THREE.Vector3());
            gltf.scene.position.sub(center);
            gltf.scene.position.y += 0.2;
            root.add(gltf.scene);
            if (mode === "figurine_3d") {
              camera.position.set(2.2, 1.4, 2.4);
              controls.target.set(0, 0.2, 0);
              controls.update();
            }
          }
        },
        undefined,
        () => undefined
      );
    };

    // The source plane is useful for marker/model modes. Pop-out deliberately
    // does not render it: only the cutout extrusion may appear in that mode.
    if (mode !== "popout" && sourceUrl) {
      const baseTexture = textureLoader.load(sourceUrl);
      baseTexture.colorSpace = THREE.SRGBColorSpace;
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(2.6, 2.6),
        new THREE.MeshBasicMaterial({ map: baseTexture, transparent: true, opacity: 0.28 })
      );
      plane.position.z = -0.2;
      scene.add(plane);
    }

    if (mode === "popout") void addPopout();
    else addModel();

    let frame = 0;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, [mode, onPopoutStats, settings, sourceUrl]);

  return (
    <div
      ref={mountRef}
      style={{
        minHeight: 420,
        width: "100%",
        position: "relative",
        backgroundColor: "#f4f1ff",
        backgroundImage:
          "linear-gradient(45deg, #e9e4fb 25%, transparent 25%), linear-gradient(-45deg, #e9e4fb 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e9e4fb 75%), linear-gradient(-45deg, transparent 75%, #e9e4fb 75%)",
        backgroundSize: "24px 24px",
        backgroundPosition: "0 0, 0 12px, 12px -12px, -12px 0"
      }}
    >
      {!sourceUrl && <p>Upload a drawing to preview the AR scene.</p>}
      {processing && <p style={{ position: "absolute", top: 12, left: 12 }}>Cutting out foreground…</p>}
      {error && (
        <p role="alert" style={{ position: "absolute", top: 12, left: 12 }}>
          {error}
        </p>
      )}
    </div>
  );
}
