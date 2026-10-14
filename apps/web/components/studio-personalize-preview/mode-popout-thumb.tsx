"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { attachGlbPointerOrbit } from "@/components/landing/glb-orbit";
import { disposePopoutObject, makePopoutComponentMesh } from "./popout-extrude-mesh";
import { createPreviewCutoutFromAlpha } from "./popout-preview-cutout";
import {
  decidePreviewPopout,
  previewLayerZ,
  previewVolumeDepth
} from "./popout-preview-normalize";

/** Demo volume — clear paper edge, same mapping as Studio Volum. */
const MODE_POPOUT_VOLUME = 72;

/**
 * Cum apare Pop-out thumb: real Studio extrusion (cutout silhouette → ExtrudeGeometry)
 * with soft float + drag-to-rotate.
 */
export function ModePopoutThumb({ imageUrl }: { imageUrl: string }) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let cancelled = false;
    let frame = 0;
    let renderer: THREE.WebGLRenderer | null = null;
    let root: THREE.Group | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let detachOrbit: (() => void) | null = null;
    const shared = new Set<THREE.Texture>();

    void (async () => {
      try {
        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        // Keep native cutout resolution so face detail stays sharp in the thumb.
        const cutout = await createPreviewCutoutFromAlpha(imageUrl, 1152);
        if (cancelled) return;
        const decision = decidePreviewPopout(cutout.polygons, cutout.stats.coverage);
        if (decision.kind !== "layers") return;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(26, 1, 0.01, 40);
        const nextRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        nextRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        nextRenderer.setClearColor(0x000000, 0);
        nextRenderer.outputColorSpace = THREE.SRGBColorSpace;
        const canvas = nextRenderer.domElement;
        canvas.className = "studio-ws__mode-glb-canvas";
        canvas.setAttribute("aria-hidden", "true");
        mount.appendChild(canvas);
        renderer = nextRenderer;

        scene.add(new THREE.AmbientLight(0xfff0e0, 0.72));
        const key = new THREE.DirectionalLight(0xfff8ef, 1.55);
        key.position.set(1.0, 2.2, 2.6);
        scene.add(key);
        const fill = new THREE.DirectionalLight(0xffffff, 0.55);
        fill.position.set(-1.6, 1.2, 1.6);
        scene.add(fill);
        const rim = new THREE.DirectionalLight(0xffd7b0, 0.45);
        rim.position.set(-1.8, 1.0, -1.2);
        scene.add(rim);

        const faceTexture = new THREE.CanvasTexture(cutout.cutoutCanvas);
        faceTexture.colorSpace = THREE.SRGBColorSpace;
        faceTexture.flipY = true;
        faceTexture.anisotropy = Math.min(8, nextRenderer.capabilities.getMaxAnisotropy());
        faceTexture.generateMipmaps = true;
        faceTexture.minFilter = THREE.LinearMipmapLinearFilter;
        faceTexture.magFilter = THREE.LinearFilter;
        faceTexture.needsUpdate = true;
        shared.add(faceTexture);

        root = new THREE.Group();
        const { depth } = previewVolumeDepth(MODE_POPOUT_VOLUME);
        const ordered = [...decision.layers].sort(
          (left, right) => left.z - right.z || right.polygon.area - left.polygon.area
        );
        for (const layer of ordered) {
          root.add(
            makePopoutComponentMesh(
              layer.polygon,
              faceTexture,
              cutout.cutoutCanvas.width,
              cutout.cutoutCanvas.height,
              cutout.rgba,
              depth,
              previewLayerZ(layer.z, MODE_POPOUT_VOLUME),
              false
            )
          );
        }
        root.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(root);
        if (!box.isEmpty()) {
          const center = box.getCenter(new THREE.Vector3());
          for (const child of root.children) {
            child.position.x -= center.x;
            child.position.y -= center.y;
            child.position.z -= center.z;
          }
        }
        scene.add(root);

        const size = box.getSize(new THREE.Vector3());
        const focus = new THREE.Vector3(0, size.y * 0.02, 0);
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        // Pull in so the extruded drawing fills the larger thumb.
        const camDist = Math.max(1.85, maxDim * 1.55);
        const restYaw = Math.PI / 7;
        const restPitch = -0.04;

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
            focus.x + Math.sin(yaw) * camDist * 0.1,
            focus.y + maxDim * 0.05 + bob * 0.1,
            focus.z + camDist
          );
          camera.up.set(0, 1, 0);
          camera.lookAt(focus);
          root.rotation.order = "YXZ";
          root.rotation.y = yaw;
          root.rotation.x = restPitch + pitch;
          root.position.y = bob;
        };

        const paint = (delta: number) => {
          if (!renderer || !root) return;
          if (!reducedMotion && !orbiting) {
            idle += delta;
            autoSpin += delta * 0.5;
          }
          const bob = !reducedMotion ? Math.sin(idle * 1.3) * 0.03 : 0;
          frameCamera(restYaw + autoSpin + orbitYaw, orbitPitch, bob);
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
          if (reducedMotion && !orbiting) {
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
            mount.closest("button")?.click();
          }
        });
        if (!reducedMotion) ensureLoop();
      } catch {
        // Empty tile on failure.
      }
    })();

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      detachOrbit?.();
      resizeObserver?.disconnect();
      if (root) disposePopoutObject(root, shared);
      for (const texture of shared) texture.dispose();
      if (renderer) {
        renderer.dispose();
        renderer.domElement.remove();
      }
    };
  }, [imageUrl]);

  return <div ref={mountRef} className="studio-ws__mode-glb studio-ws__mode-glb--popout" />;
}
