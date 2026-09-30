"use client";

import * as THREE from "three";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/**
 * One Draco decoder for the whole page.
 *
 * Each DRACOLoader fetches the decoder, compiles its own wasm module and runs
 * its own worker pool. A loader per component multiplied that by the number of
 * GLBs on screen, and the Decor step puts eleven thumbs plus every placed prop
 * up at once. The instance is intentionally never disposed: it holds no
 * per-model state and outlives any single component.
 */
let sharedDraco: DRACOLoader | null = null;

function dracoLoader(): DRACOLoader {
  if (!sharedDraco) {
    sharedDraco = new DRACOLoader();
    sharedDraco.setDecoderPath("/draco/gltf/");
  }
  return sharedDraco;
}

/** GLTFLoader wired to the shared decoder. Callers must not dispose the decoder. */
export function createGlbLoader(): GLTFLoader {
  const loader = new GLTFLoader();
  loader.setDRACOLoader(dracoLoader());
  return loader;
}

/** Release geometry, textures and materials once a prop leaves the stage. */
export function disposeObject(object: THREE.Object3D) {
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
