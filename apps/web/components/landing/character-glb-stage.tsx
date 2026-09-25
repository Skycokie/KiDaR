import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { popoutSpinSettled, popoutSpinYaw } from "./popout-turn";

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

/**
 * Homepage demo GLB viewer. Mounted only after the first hover/click.
 * No AnimationMixer — Tripo demos have zero clips. One whole-object turn per spinId.
 * Lives inside the DrawingScene client boundary (no separate "use client" entry).
 */
export function CharacterGlbStage({
  modelUrl,
  active,
  restYawRad,
  spinId,
  stageClassName = "landing-character__stage",
  canvasClassName = "landing-character__canvas",
  onReady,
  onFallback,
  onSpinDone
}: {
  modelUrl: string;
  active: boolean;
  restYawRad: number;
  spinId: number;
  stageClassName?: string;
  canvasClassName?: string;
  onReady: () => void;
  onFallback: () => void;
  onSpinDone: () => void;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef(active);
  const kickRef = useRef<(() => void) | null>(null);
  const onReadyRef = useRef(onReady);
  const onFallbackRef = useRef(onFallback);
  const onSpinDoneRef = useRef(onSpinDone);
  const spinEpochRef = useRef(0);
  const spinElapsedRef = useRef(0);
  const spinningRef = useRef(false);
  activeRef.current = active;
  onReadyRef.current = onReady;
  onFallbackRef.current = onFallback;
  onSpinDoneRef.current = onSpinDone;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let cancelled = false;
    let frame = 0;
    let renderer: THREE.WebGLRenderer | null = null;
    let root: THREE.Object3D | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let detachVisibility: (() => void) | null = null;
    let settled = false;

    void (async () => {
      try {
        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const mobile = window.matchMedia("(max-width: 699px)").matches;
        const nextRenderer = new THREE.WebGLRenderer({ antialias: !reducedMotion, alpha: true });
        nextRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2));
        nextRenderer.setClearColor(0x000000, 0);
        nextRenderer.outputColorSpace = THREE.SRGBColorSpace;
        const canvas = nextRenderer.domElement;
        canvas.className = canvasClassName;
        canvas.setAttribute("aria-hidden", "true");
        mount.appendChild(canvas);
        renderer = nextRenderer;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(34, 1, 0.01, 40);

        const gltf = await new GLTFLoader().loadAsync(modelUrl);
        if (cancelled) return;

        root = gltf.scene;
        const box = new THREE.Box3().setFromObject(root);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        root.position.sub(center);
        const minY = box.min.y - center.y;
        root.position.y -= minY;
        scene.add(root);

        scene.add(new THREE.AmbientLight(0xfff4e8, 0.95));
        const key = new THREE.DirectionalLight(0xfff8ef, 1.45);
        key.position.set(1.2, 2.0, 2.8);
        scene.add(key);
        const fill = new THREE.DirectionalLight(0xffffff, 0.7);
        fill.position.set(-1.4, 1.2, 1.6);
        scene.add(fill);
        const rim = new THREE.DirectionalLight(0xffe0c0, 0.5);
        rim.position.set(-1.8, 1.0, -1.2);
        scene.add(rim);

        const focus = new THREE.Vector3(0, Math.max(0.35, size.y * 0.42), 0);
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        const camDist = Math.max(3.0, maxDim * 2.5);

        const resize = () => {
          if (!renderer) return;
          const width = Math.max(1, mount.clientWidth);
          const height = Math.max(1, mount.clientHeight);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          renderer.setSize(width, height, false);
        };

        const frameCamera = (yawRad: number) => {
          if (!root) return;
          camera.position.set(focus.x, focus.y + maxDim * 0.05, focus.z + camDist);
          camera.up.set(0, 1, 0);
          camera.lookAt(focus);
          root.rotation.order = "YXZ";
          root.rotation.y = yawRad;
          root.rotation.x = THREE.MathUtils.degToRad(-4);
        };

        resize();
        frameCamera(restYawRad);
        resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(mount);

        let idleElapsed = 0;
        let lastStamp = 0;
        let finishedEpoch = 0;
        const baseY = root.position.y;

        const pose = (delta: number) => {
          if (!root) return;
          const spinning = spinningRef.current && !reducedMotion;
          if (spinning) idleElapsed += delta;
          const bob = spinning ? Math.sin(idleElapsed * 1.55) * 0.02 : 0;
          const tilt = spinning ? Math.sin(idleElapsed * 0.7) * 0.04 : 0;
          let yaw = restYawRad;
          if (spinning) {
            spinElapsedRef.current += delta;
            yaw += popoutSpinYaw(spinElapsedRef.current);
            if (popoutSpinSettled(spinElapsedRef.current) && finishedEpoch !== spinEpochRef.current) {
              finishedEpoch = spinEpochRef.current;
              spinningRef.current = false;
              onSpinDoneRef.current();
            }
          }
          root.position.y = baseY + bob;
          root.rotation.z = tilt;
          frameCamera(yaw);
        };

        const loop = (now: number) => {
          if (cancelled || !renderer || !root) return;
          if (!activeRef.current || document.hidden) {
            frame = 0;
            lastStamp = 0;
            return;
          }
          frame = window.requestAnimationFrame(loop);
          const delta = lastStamp ? Math.min(0.05, (now - lastStamp) / 1000) : 0;
          lastStamp = now;
          pose(delta);
          renderer.render(scene, camera);
        };

        const kick = () => {
          if (cancelled || frame || !renderer) return;
          if (reducedMotion) {
            pose(0);
            renderer.render(scene, camera);
            return;
          }
          if (!activeRef.current || document.hidden) return;
          frame = window.requestAnimationFrame(loop);
        };
        kickRef.current = kick;
        const onVisibility = () => {
          if (!document.hidden) kick();
        };
        document.addEventListener("visibilitychange", onVisibility);
        detachVisibility = () => {
          document.removeEventListener("visibilitychange", onVisibility);
        };
        kick();

        if (!cancelled && !settled) {
          settled = true;
          onReadyRef.current();
        }
      } catch {
        if (!cancelled && !settled) {
          settled = true;
          onFallbackRef.current();
        }
      }
    })();

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      detachVisibility?.();
      kickRef.current = null;
      if (root) disposeObject(root);
      if (renderer) {
        renderer.dispose();
        renderer.domElement.remove();
      }
    };
  }, [modelUrl, restYawRad, stageClassName, canvasClassName]);

  useEffect(() => {
    kickRef.current?.();
  }, [active]);

  useEffect(() => {
    if (spinId <= 0) return;
    spinEpochRef.current = spinId;
    spinElapsedRef.current = 0;
    spinningRef.current = true;
    kickRef.current?.();
  }, [spinId]);

  return <div ref={mountRef} className={stageClassName} />;
}
