"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

function disposeObject(object: THREE.Object3D) {
  object.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry?.dispose();
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      const std = material as THREE.MeshStandardMaterial;
      std.map?.dispose();
      std.normalMap?.dispose();
      std.roughnessMap?.dispose();
      std.metalnessMap?.dispose();
      std.emissiveMap?.dispose();
      std.aoMap?.dispose();
      material.dispose();
    }
  });
}

function createGlbLoader() {
  const loader = new GLTFLoader();
  const draco = new DRACOLoader();
  draco.setDecoderPath("/draco/gltf/");
  loader.setDRACOLoader(draco);
  return { loader, draco };
}

/**
 * Stage decor GLB — static pose (no auto-spin). Parent handles drag-to-move
 * and click-to-remove. yaw/pitch from DecorInstance set the facing.
 */
export function StageGlbProp({
  modelUrl,
  variant,
  yaw = 0,
  pitch = 0
}: {
  modelUrl: string;
  variant: "decor" | "motion";
  yaw?: number;
  pitch?: number;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const paintRef = useRef<((nextYaw: number, nextPitch: number) => void) | null>(null);
  const orbitRef = useRef({ yaw, pitch });
  orbitRef.current = { yaw, pitch };

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let cancelled = false;
    let renderer: THREE.WebGLRenderer | null = null;
    let root: THREE.Object3D | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let draco: DRACOLoader | null = null;

    void (async () => {
      try {
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(28, 1, 0.01, 40);
        const nextRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        nextRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
        nextRenderer.setClearColor(0x000000, 0);
        nextRenderer.outputColorSpace = THREE.SRGBColorSpace;
        const canvas = nextRenderer.domElement;
        canvas.className = "studio-stage__glb-canvas";
        canvas.setAttribute("aria-hidden", "true");
        mount.appendChild(canvas);
        renderer = nextRenderer;

        scene.add(new THREE.AmbientLight(0xfff4e8, 0.95));
        const key = new THREE.DirectionalLight(0xfff8ef, 1.35);
        key.position.set(1.1, 2.1, 2.4);
        scene.add(key);
        const fill = new THREE.DirectionalLight(0xffffff, 0.65);
        fill.position.set(-1.4, 1.1, 1.4);
        scene.add(fill);
        const rim = new THREE.DirectionalLight(0xffe0c0, 0.4);
        rim.position.set(-1.6, 0.9, -1.2);
        scene.add(rim);

        const created = createGlbLoader();
        draco = created.draco;
        const gltf = await created.loader.loadAsync(modelUrl);
        if (cancelled) return;
        root = gltf.scene;

        const box = new THREE.Box3().setFromObject(root);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        root.position.sub(center);
        const minY = box.min.y - center.y;
        root.position.y -= minY;
        scene.add(root);

        const focus = new THREE.Vector3(0, Math.max(0.22, size.y * 0.42), 0);
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        const camDist = Math.max(2.6, maxDim * 2.55);
        const restYaw = Math.PI / 7;
        const restPitch = -0.04;

        const resize = () => {
          if (!renderer) return;
          const width = Math.max(1, mount.clientWidth);
          const height = Math.max(1, mount.clientHeight);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          renderer.setSize(width, height, false);
        };

        const paint = (orbitYaw: number, orbitPitch: number) => {
          if (!renderer || !root) return;
          const facing = restYaw + orbitYaw;
          camera.position.set(
            focus.x + Math.sin(facing) * camDist * 0.1,
            focus.y + maxDim * 0.02,
            focus.z + camDist
          );
          camera.up.set(0, 1, 0);
          camera.lookAt(focus);
          root.rotation.order = "YXZ";
          root.rotation.y = facing;
          root.rotation.x = restPitch + orbitPitch;
          root.position.y = -minY;
          renderer.render(scene, camera);
        };

        paintRef.current = paint;
        resize();
        paint(orbitRef.current.yaw, orbitRef.current.pitch);
        resizeObserver = new ResizeObserver(() => {
          resize();
          paint(orbitRef.current.yaw, orbitRef.current.pitch);
        });
        resizeObserver.observe(mount);
      } catch {
        // Empty tile on failure.
      }
    })();

    return () => {
      cancelled = true;
      paintRef.current = null;
      resizeObserver?.disconnect();
      if (root) disposeObject(root);
      draco?.dispose();
      if (renderer) {
        renderer.dispose();
        renderer.domElement.remove();
      }
    };
    // yaw/pitch applied in a separate effect so the GLB is not reloaded on orbit.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per model
  }, [modelUrl, variant]);

  useEffect(() => {
    paintRef.current?.(yaw, pitch);
  }, [yaw, pitch]);

  return (
    <div
      ref={mountRef}
      className={`studio-stage__glb-prop studio-stage__glb-prop--${variant}`}
      aria-hidden="true"
    />
  );
}
