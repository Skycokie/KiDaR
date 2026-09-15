"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  alphaMaskFromRgba,
  extractSilhouettePolygons,
  getSilhouetteStats,
  type StickerPolygon
} from "@kidar/core";
import type { ProjectSettings } from "@kidar/core";

type PreviewMode = "popout" | "gallery" | "upload";

async function createCutout(sourceUrl: string) {
  const { removeBackground } = await import("@imgly/background-removal");
  const cutoutBlob = await removeBackground(sourceUrl);
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
  const polygons = extractSilhouettePolygons(mask, {
    cleanupRadius: Math.max(1, Math.round(Math.min(canvas.width, canvas.height) / 800)),
    simplifyEpsilon: 0.006,
    minComponentPixels: Math.max(12, Math.floor(canvas.width * canvas.height * 0.00015))
  });
  if (!polygons.length) throw new Error("No foreground silhouette was detected");
  const stats = getSilhouetteStats(mask, polygons);
  if (stats.coverage >= 0.9) {
    throw new Error("Foreground mask covers almost the whole image; refusing full-rectangle extrusion");
  }
  return { canvas, polygons };
}

function makeExtrudedSticker(
  polygon: StickerPolygon,
  texture: THREE.CanvasTexture,
  accent: string
) {
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

  const front = new THREE.MeshStandardMaterial({
    map: texture,
    transparent: true,
    alphaTest: 0.04,
    roughness: 0.52,
    metalness: 0.02
  });
  const side = new THREE.MeshStandardMaterial({
    color: accent,
    roughness: 0.48,
    metalness: 0.02
  });
  const mesh = new THREE.Mesh(geometry, [front, side]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function ThreePreview({
  sourceUrl,
  mode,
  settings
}: {
  sourceUrl: string | null;
  mode: PreviewMode;
  settings: ProjectSettings;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
    camera.position.set(0, 0.2, 4.5);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 0, 0);
    scene.add(new THREE.HemisphereLight("#ffffff", "#aaa0c7", 2));

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
        const { canvas, polygons } = await createCutout(sourceUrl);
        if (disposed) return;
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        polygons.forEach((polygon) => {
          root.add(makeExtrudedSticker(polygon, texture, settings.theme));
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
      const modelUrl = mode === "gallery" ? settings.galleryModelUrl : settings.uploadModelUrl;
      if (!modelUrl) return;
      new GLTFLoader().load(
        modelUrl,
        (gltf) => {
          if (!disposed) {
            gltf.scene.position.y = 0.25;
            gltf.scene.scale.setScalar(0.8);
            root.add(gltf.scene);
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
  }, [mode, settings, sourceUrl]);

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
