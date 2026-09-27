"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
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

function groundFigurineModel(scene: THREE.Object3D) {
  const box0 = new THREE.Box3().setFromObject(scene);
  const size0 = box0.getSize(new THREE.Vector3());
  const maxDim = Math.max(size0.x, size0.y, size0.z, 0.01);
  scene.scale.setScalar(1.55 / maxDim);
  const box = new THREE.Box3().setFromObject(scene);
  const center = box.getCenter(new THREE.Vector3());
  scene.position.set(-center.x, -box.min.y, -center.z);
  scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
  });
  return box.getSize(new THREE.Vector3());
}

/**
 * Studio stage viewer for a finished Tripo figurine.glb.
 * Orbit comes from the shared personalize controls (yaw/pitch/roll/zoom).
 */
export function FigurineGlbStage({
  modelUrl,
  yaw,
  pitch,
  roll,
  zoom,
  volume
}: {
  modelUrl: string;
  yaw: number;
  pitch: number;
  roll: number;
  zoom: number;
  volume: number;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const poseRef = useRef({ yaw, pitch, roll, zoom, volume });
  poseRef.current = { yaw, pitch, roll, zoom, volume };

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let cancelled = false;
    let frame = 0;
    let renderer: THREE.WebGLRenderer | null = null;
    let root: THREE.Group | null = null;
    let resizeObserver: ResizeObserver | null = null;

    void (async () => {
      try {
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 40);
        camera.position.set(0, 0.72, 2.55);

        const nextRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        nextRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        nextRenderer.setClearColor(0x000000, 0);
        nextRenderer.shadowMap.enabled = true;
        mount.appendChild(nextRenderer.domElement);
        renderer = nextRenderer;

        scene.add(new THREE.HemisphereLight("#fff8f0", "#2a241c", 0.8));
        const key = new THREE.DirectionalLight("#fff4e6", 1.15);
        key.position.set(2.2, 3.2, 2.4);
        key.castShadow = true;
        scene.add(key);
        const fill = new THREE.DirectionalLight("#eaeeff", 0.55);
        fill.position.set(-2.6, 1.6, -1.4);
        scene.add(fill);
        scene.add(new THREE.AmbientLight("#fff8f0", 0.45));

        const pivot = new THREE.Group();
        scene.add(pivot);
        root = pivot;

        const gltf = await new GLTFLoader().loadAsync(modelUrl);
        if (cancelled) return;
        const size = groundFigurineModel(gltf.scene);
        pivot.add(gltf.scene);
        camera.position.set(0, Math.max(0.55, size.y * 0.55), 2.45);
        camera.lookAt(0, size.y * 0.42, 0);

        const resize = () => {
          const width = mount.clientWidth || 320;
          const height = mount.clientHeight || 420;
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          nextRenderer.setSize(width, height, false);
        };
        resize();
        resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(mount);

        const loop = () => {
          const pose = poseRef.current;
          const volumeScale = 0.82 + pose.volume / 280;
          const zoomScale = 0.7 + pose.zoom / 250;
          pivot.rotation.set(
            THREE.MathUtils.degToRad(pose.pitch),
            THREE.MathUtils.degToRad(pose.yaw),
            THREE.MathUtils.degToRad(pose.roll)
          );
          pivot.scale.setScalar(volumeScale * zoomScale);
          nextRenderer.render(scene, camera);
          frame = window.requestAnimationFrame(loop);
        };
        frame = window.requestAnimationFrame(loop);
      } catch {
        if (!cancelled && mount.isConnected) {
          mount.dataset.figurineLoad = "failed";
        }
      }
    })();

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      if (root) disposeObject(root);
      renderer?.dispose();
      renderer?.domElement.remove();
    };
  }, [modelUrl]);

  return <div ref={mountRef} className="studio-stage__figurine-canvas" data-figurine-src={modelUrl} />;
}
