"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { ProjectSettings } from "@kidar/core";

type PreviewMode = "popout" | "gallery" | "upload";

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

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#f4f1ff");
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

    const textureLoader = new THREE.TextureLoader();
    let disposed = false;
    let objectUrl: string | null = null;

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
      let imageUrl = sourceUrl;
      try {
        const { removeBackground } = await import("@imgly/background-removal");
        const blob = await removeBackground(sourceUrl);
        objectUrl = URL.createObjectURL(blob);
        imageUrl = objectUrl;
      } catch {
        // JPGs and already-transparent PNGs still preview with the source.
      }
      if (disposed) return;

      textureLoader.load(imageUrl, (texture) => {
        if (disposed) return;
        texture.colorSpace = THREE.SRGBColorSpace;
        const aspect = texture.image.width / texture.image.height || 1;
        const geometry = new THREE.PlaneGeometry(2.2, 2.2 / aspect);
        for (let index = 0; index < 5; index += 1) {
          const depth = (index - 2) * 0.035;
          const material = new THREE.MeshStandardMaterial({
            map: texture,
            transparent: true,
            alphaTest: 0.04,
            color: index === 4 ? "#ffffff" : settings.theme,
            roughness: 0.58,
            metalness: 0.02
          });
          const layer = new THREE.Mesh(geometry, material);
          layer.position.z = depth;
          layer.scale.setScalar(index === 4 ? 1 : 1.035);
          root.add(layer);
        }
        setProcessing(false);
      });
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

    const basePlane = sourceUrl
      ? textureLoader.load(sourceUrl, (texture) => {
          texture.colorSpace = THREE.SRGBColorSpace;
        })
      : null;
    if (basePlane) {
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(2.6, 2.6),
        new THREE.MeshBasicMaterial({ map: basePlane, transparent: true, opacity: 0.28 })
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
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      mount.removeChild(renderer.domElement);
    };
  }, [mode, settings, sourceUrl]);

  return (
    <div ref={mountRef} style={{ minHeight: 420, width: "100%", position: "relative" }}>
      {!sourceUrl && <p>Upload a drawing to preview the AR scene.</p>}
      {processing && <p style={{ position: "absolute", top: 12, left: 12 }}>Preparing sticker…</p>}
    </div>
  );
}
