import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { starlitEmergePose, type StarlitPhase } from "./starlit-emerge";

const MODEL_URL = "/demo/starlit/starlit-secret.glb";
const RETURN_SECONDS = 0.7;

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
      material.dispose();
    }
  });
}

/**
 * Homepage-only relief of the hero photo. It eases forward out of the picture on click,
 * then rests with a small float. Clicking it sends it back into the photo.
 * No camera, no network besides the local GLB.
 */
export function StarlitEmergeStage({
  phase,
  onOut,
  onHidden
}: {
  phase: StarlitPhase;
  onOut: () => void;
  onHidden: () => void;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const phaseRef = useRef(phase);
  const onOutRef = useRef(onOut);
  const onHiddenRef = useRef(onHidden);
  const amountRef = useRef(0);
  const animRef = useRef<{ started: number; from: number; to: number; duration: number } | null>(null);
  const kickRef = useRef<(() => void) | null>(null);
  const readyRef = useRef(false);
  phaseRef.current = phase;
  onOutRef.current = onOut;
  onHiddenRef.current = onHidden;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let cancelled = false;
    let frame = 0;
    let renderer: THREE.WebGLRenderer | null = null;
    let root: THREE.Object3D | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let detachVisibility: (() => void) | null = null;
    let idleSeconds = 0;

    void (async () => {
      try {
        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const mobile = window.matchMedia("(max-width: 699px)").matches;
        const nextRenderer = new THREE.WebGLRenderer({ antialias: !reducedMotion, alpha: true });
        nextRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2));
        nextRenderer.setClearColor(0x000000, 0);
        nextRenderer.outputColorSpace = THREE.SRGBColorSpace;
        const canvas = nextRenderer.domElement;
        canvas.className = "starlit-emerge__canvas";
        canvas.setAttribute("aria-hidden", "true");
        mount.appendChild(canvas);
        renderer = nextRenderer;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(26, 1, 0.01, 40);
        const gltf = await new GLTFLoader().loadAsync(MODEL_URL);
        if (cancelled) return;

        root = gltf.scene;
        const box = new THREE.Box3().setFromObject(root);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        root.position.sub(center);
        const base = root.position.clone();
        scene.add(root);

        scene.add(new THREE.AmbientLight(0xfff1e0, 0.85));
        const key = new THREE.DirectionalLight(0xffe2b0, 1.35);
        key.position.set(-1.4, 2.2, 2.4);
        scene.add(key);
        const fill = new THREE.DirectionalLight(0x9eb4ff, 0.45);
        fill.position.set(1.6, 0.8, 1.2);
        scene.add(fill);
        const magic = new THREE.PointLight(0xffb45a, 0, 8);
        magic.position.set(0.2, -0.2, 1.4);
        scene.add(magic);

        const fit = () => {
          const width = Math.max(1, mount.clientWidth);
          const height = Math.max(1, mount.clientHeight);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          renderer?.setSize(width, height, false);
          const vertical = (size.y / 2) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
          const horizontal =
            (size.x / 2) / (Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect);
          const distance = Math.max(vertical, horizontal) * 1.08 + size.z;
          camera.position.set(0, size.y * 0.02, distance);
          camera.lookAt(0, 0, 0);
        };

        fit();
        resizeObserver = new ResizeObserver(fit);
        resizeObserver.observe(mount);

        const applyAmount = (amount: number) => {
          if (!root || !renderer) return;
          amountRef.current = amount;
          const next = starlitEmergePose(amount, reducedMotion ? 0 : idleSeconds);
          root.scale.setScalar(next.scale);
          root.position.set(base.x, base.y, base.z + next.forward);
          root.rotation.x = next.tilt;
          root.rotation.y = next.sway;
          magic.intensity = 0.2 + amount * 1.6;
          renderer.render(scene, camera);
        };

        const step = (now: number) => {
          const anim = animRef.current;
          if (!anim) return;
          const t = anim.duration <= 0 ? 1 : Math.min(1, (now - anim.started) / (anim.duration * 1000));
          const eased = 1 - (1 - t) ** 3;
          applyAmount(anim.from + (anim.to - anim.from) * eased);
          if (t >= 1) {
            animRef.current = null;
            if (anim.to >= 1) onOutRef.current();
            else onHiddenRef.current();
          }
        };

        const loop = (now: number) => {
          if (cancelled || !renderer || !root) return;
          if (document.hidden) {
            frame = 0;
            return;
          }
          frame = window.requestAnimationFrame(loop);
          if (animRef.current) {
            step(now);
          } else if (amountRef.current >= 1 && !reducedMotion) {
            idleSeconds += 1 / 60;
            applyAmount(1);
          }
        };

        const kick = () => {
          if (cancelled || frame || !renderer) return;
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

        readyRef.current = true;
        applyAmount(amountRef.current);
        if (phaseRef.current === "emerging" || phaseRef.current === "out") {
          animRef.current = {
            started: performance.now(),
            from: amountRef.current,
            to: 1,
            duration: reducedMotion ? 0 : 3.2 * (1 - amountRef.current)
          };
          kick();
        }
      } catch {
        onHiddenRef.current();
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
  }, []);

  useEffect(() => {
    if (!readyRef.current) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (phase === "emerging") {
      animRef.current = {
        started: performance.now(),
        from: amountRef.current,
        to: 1,
        duration: reducedMotion ? 0 : 3.2 * (1 - amountRef.current)
      };
    } else if (phase === "returning") {
      animRef.current = {
        started: performance.now(),
        from: amountRef.current,
        to: 0,
        duration: reducedMotion ? 0 : RETURN_SECONDS * amountRef.current
      };
    }
    kickRef.current?.();
  }, [phase]);

  return <div ref={mountRef} className="starlit-emerge__stage" />;
}
