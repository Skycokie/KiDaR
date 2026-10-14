"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { attachGlbPointerOrbit } from "@/components/landing/glb-orbit";

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
 * Tiny decorative GLB thumb for Personaj → Cum apare / Mișcare cards.
 * Pop-out: flattened + re-thickened Z so the relief reads as extruded paper.
 * Figurine: soft float + drag-to-rotate (and gentle auto-spin when idle).
 */
export function ModeGlbThumb({
  modelUrl,
  variant,
  /** When false, preview animates but does not steal clicks (used on Decor cards). */
  interactive = true
}: {
  modelUrl: string;
  variant: "popout" | "figurine";
  interactive?: boolean;
}) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let cancelled = false;
    let frame = 0;
    let renderer: THREE.WebGLRenderer | null = null;
    let root: THREE.Object3D | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let detachOrbit: (() => void) | null = null;
    let draco: DRACOLoader | null = null;

    void (async () => {
      try {
        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(28, 1, 0.01, 40);
        const nextRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        nextRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
        nextRenderer.setClearColor(0x000000, 0);
        nextRenderer.outputColorSpace = THREE.SRGBColorSpace;
        const canvas = nextRenderer.domElement;
        canvas.className = "studio-ws__mode-glb-canvas";
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
        const rim = new THREE.DirectionalLight(0xffe0c0, 0.45);
        rim.position.set(-1.6, 0.9, -1.2);
        scene.add(rim);

        const created = createGlbLoader();
        draco = created.draco;
        const gltf = await created.loader.loadAsync(modelUrl);
        if (cancelled) return;
        root = gltf.scene;

        if (variant === "popout") {
          // Squash then restore a real paper-extrusion depth so edges read.
          root.scale.z *= 0.22;
          root.updateMatrixWorld(true);
          const boxFlat = new THREE.Box3().setFromObject(root);
          const depth = Math.max(0.001, boxFlat.max.z - boxFlat.min.z);
          const targetDepth = Math.max(boxFlat.max.x - boxFlat.min.x, boxFlat.max.y - boxFlat.min.y) * 0.14;
          root.scale.z *= targetDepth / depth;
        }

        const box = new THREE.Box3().setFromObject(root);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        root.position.sub(center);
        const minY = box.min.y - center.y;
        root.position.y -= minY;
        scene.add(root);

        const focus = new THREE.Vector3(0, Math.max(0.28, size.y * 0.42), 0);
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        const camDist = Math.max(2.4, maxDim * (variant === "popout" ? 2.15 : 2.35));
        const restYaw = variant === "popout" ? Math.PI / 5 : Math.PI / 7;
        const restPitch = variant === "popout" ? -0.08 : -0.04;

        let orbitYaw = 0;
        let orbitPitch = 0;
        let orbiting = false;
        let autoSpin = 0;
        let idle = 0;
        let last = 0;

        const resize = () => {
          if (!renderer) return;
          const width = Math.max(1, mount.clientWidth);
          const height = Math.max(1, mount.clientHeight);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          renderer.setSize(width, height, false);
        };

        const frameCamera = (yaw: number, pitch: number, bob = 0) => {
          if (!root) return;
          camera.position.set(
            focus.x + Math.sin(yaw) * camDist * 0.12,
            focus.y + maxDim * 0.04 + bob * 0.12,
            focus.z + camDist
          );
          camera.up.set(0, 1, 0);
          camera.lookAt(focus);
          root.rotation.order = "YXZ";
          root.rotation.y = yaw;
          root.rotation.x = restPitch + pitch;
          root.position.y = -minY + bob;
        };

        const paint = (delta: number) => {
          if (!renderer || !root) return;
          if (variant === "figurine") {
            if (!reducedMotion && !orbiting) {
              idle += delta;
              autoSpin += delta * 0.55;
            }
            const bob = !reducedMotion ? Math.sin(idle * 1.35) * 0.028 : 0;
            frameCamera(restYaw + autoSpin + orbitYaw, orbitPitch, bob);
          } else {
            frameCamera(restYaw, 0, 0);
          }
          renderer.render(scene, camera);
        };

        const ensureLoop = () => {
          if (cancelled || frame || document.hidden) return;
          frame = window.requestAnimationFrame(loop);
        };

        const loop = (now: number) => {
          if (cancelled || !renderer || !root) {
            frame = 0;
            return;
          }
          const needsMotion =
            variant === "figurine" && (!reducedMotion || orbiting);
          if (!needsMotion && !orbiting) {
            frame = 0;
            paint(0);
            return;
          }
          frame = window.requestAnimationFrame(loop);
          const delta = last ? Math.min(0.05, (now - last) / 1000) : 0;
          last = now;
          paint(delta);
        };

        resize();
        paint(0);
        resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(mount);

        if (variant === "figurine" && interactive) {
          detachOrbit = attachGlbPointerOrbit(mount, {
            getYaw: () => orbitYaw,
            getPitch: () => orbitPitch,
            setOrbit: (yaw, pitch) => {
              orbitYaw = yaw;
              orbitPitch = pitch;
            },
            onPaint: () => {
              paint(0);
              ensureLoop();
            },
            onDragStart: () => {
              orbiting = true;
              ensureLoop();
            },
            onDragEnd: () => {
              orbiting = false;
              last = 0;
              ensureLoop();
            },
            onIdleClick: () => {
              const card = mount.closest("button");
              card?.click();
            }
          });
        }
        if (variant === "figurine" && !reducedMotion) ensureLoop();
      } catch {
        // Keep empty preview tile on failure.
      }
    })();

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      detachOrbit?.();
      resizeObserver?.disconnect();
      if (root) disposeObject(root);
      draco?.dispose();
      if (renderer) {
        renderer.dispose();
        renderer.domElement.remove();
      }
    };
  }, [modelUrl, variant, interactive]);

  return (
    <div
      ref={mountRef}
      className={`studio-ws__mode-glb studio-ws__mode-glb--${variant}${interactive ? "" : " is-passive"}`}
    />
  );
}
