"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import {
  JOURNEY_STATIC_TIME,
  journeyParticle,
  journeyParticleCountForViewport
} from "./hero-journey-particles";

/** Half extent of the square scene box. The story lives in about -0.9..0.9. */
const VIEW_HALF = 1.15;

function softDiscTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.4, "rgba(255,255,255,0.5)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function scheduleIdle(run: () => void): () => void {
  const ric = window.requestIdleCallback?.bind(window);
  if (ric) {
    const id = ric(() => run(), { timeout: 1800 });
    return () => window.cancelIdleCallback?.(id);
  }
  const id = window.setTimeout(run, 220);
  return () => window.clearTimeout(id);
}

/**
 * Decorative "kidAR story loop": one swarm of particles that draws, builds a
 * character and a small world, speaks, moves into an AR phone and becomes a QR.
 * Pointer events are off; the canvas is square and aria-hidden.
 */
export function HeroJourneyStage({
  playing = false,
  onReducedMotion
}: {
  /** Only matters under reduced motion: the visitor asked to watch the loop anyway. */
  playing?: boolean;
  onReducedMotion?: (reduced: boolean) => void;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const playingRef = useRef(playing);
  const reducedCallbackRef = useRef(onReducedMotion);
  const syncRef = useRef<(() => void) | null>(null);
  reducedCallbackRef.current = onReducedMotion;

  useEffect(() => {
    playingRef.current = playing;
    syncRef.current?.();
  }, [playing]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let cancelled = false;
    let frame = 0;
    let stillFrame = 0;
    let renderer: THREE.WebGLRenderer | null = null;
    let geometry: THREE.BufferGeometry | null = null;
    let material: THREE.PointsMaterial | null = null;
    let texture: THREE.CanvasTexture | null = null;
    let points: THREE.Points | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let intersectionObserver: IntersectionObserver | null = null;
    let cancelIdle: (() => void) | null = null;
    let detachVisibility: (() => void) | null = null;
    let visible = true;
    let started = false;
    // Loop clock: only advances while the scene is visible, so it never jumps on resume.
    let clock = 0;
    let lastNow = 0;

    const target = new THREE.Vector3();
    const color = new THREE.Color();

    const tearDown = () => {
      syncRef.current = null;
      window.cancelAnimationFrame(frame);
      window.cancelAnimationFrame(stillFrame);
      stillFrame = 0;
      frame = 0;
      resizeObserver?.disconnect();
      intersectionObserver?.disconnect();
      detachVisibility?.();
      cancelIdle?.();
      if (points) {
        points.parent?.remove(points);
        points = null;
      }
      geometry?.dispose();
      material?.dispose();
      texture?.dispose();
      if (renderer) {
        renderer.dispose();
        renderer.domElement.remove();
        renderer = null;
      }
      geometry = null;
      material = null;
      texture = null;
    };

    const boot = () => {
      if (cancelled || started) return;
      started = true;

      try {
        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const nextRenderer = new THREE.WebGLRenderer({
          antialias: false,
          alpha: true,
          powerPreference: "low-power"
        });
        nextRenderer.setClearColor(0x000000, 0);
        nextRenderer.outputColorSpace = THREE.SRGBColorSpace;
        const canvas = nextRenderer.domElement;
        canvas.className = "journey-scene__canvas";
        canvas.setAttribute("aria-hidden", "true");
        mount.appendChild(canvas);
        renderer = nextRenderer;

        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-VIEW_HALF, VIEW_HALF, VIEW_HALF, -VIEW_HALF, 0.1, 10);
        camera.position.z = 2;

        const count = journeyParticleCountForViewport(window.innerWidth);
        geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
        geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(count * 3), 3));

        texture = softDiscTexture();
        material = new THREE.PointsMaterial({
          size: 5,
          map: texture,
          transparent: true,
          depthWrite: false,
          // Normal blending: overlapping particles stay colored, never blow out to white.
          blending: THREE.NormalBlending,
          vertexColors: true,
          sizeAttenuation: false,
          opacity: 0.92
        });
        points = new THREE.Points(geometry, material);
        points.frustumCulled = false;
        scene.add(points);

        const writeParticles = (time: number) => {
          if (!geometry) return;
          const pos = geometry.attributes.position as THREE.BufferAttribute;
          const col = geometry.attributes.color as THREE.BufferAttribute;
          for (let i = 0; i < count; i += 1) {
            journeyParticle(i, count, time, target, color);
            pos.setXYZ(i, target.x, target.y, target.z);
            col.setXYZ(i, color.r, color.g, color.b);
          }
          pos.needsUpdate = true;
          col.needsUpdate = true;
        };

        // Resizing clears a WebGL canvas. While the loop is not running (still frame under
        // reduced motion, or paused), redraw the last frame or the scene stays blank.
        let lastPaintTime = JOURNEY_STATIC_TIME;
        let repaint: (() => void) | null = null;

        const fit = () => {
          if (!renderer) return;
          const width = Math.max(1, mount.clientWidth);
          const height = Math.max(1, mount.clientHeight);
          renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
          renderer.setSize(width, height, false);
          if (material) material.size = width < 360 ? 4 : width < 520 ? 4.5 : 5.5;
          if (!frame) drawStill();
        };

        // Safari only reliably presents a WebGL canvas that was drawn inside an animation frame.
        const drawStill = () => {
          if (stillFrame) return;
          stillFrame = window.requestAnimationFrame(() => {
            stillFrame = 0;
            if (!cancelled && !frame) repaint?.();
          });
        };

        fit();
        resizeObserver = new ResizeObserver(fit);
        resizeObserver.observe(mount);

        const paint = (time: number) => {
          if (!renderer) return;
          lastPaintTime = time;
          writeParticles(time);
          renderer.render(scene, camera);
        };
        repaint = () => paint(lastPaintTime);

        // Reduced motion shows one still frame until the visitor presses play.
        const motionAllowed = () => !reducedMotion || playingRef.current;
        if (reducedMotion) {
          drawStill();
          reducedCallbackRef.current?.(true);
        }

        const kick = () => {
          if (cancelled || frame || !renderer || !visible || document.hidden || !motionAllowed()) return;
          lastNow = 0;
          frame = window.requestAnimationFrame(loop);
        };

        const loop = (now: number) => {
          if (cancelled || !renderer) return;
          if (document.hidden || !visible || !motionAllowed()) {
            frame = 0;
            return;
          }
          frame = window.requestAnimationFrame(loop);
          // Clamp the step so a stalled tab never fast-forwards the story.
          const step = lastNow ? Math.min(0.1, (now - lastNow) * 0.001) : 0;
          lastNow = now;
          clock += step;
          paint(clock);
        };

        const onVisibility = () => {
          if (document.hidden) {
            window.cancelAnimationFrame(frame);
            frame = 0;
          } else {
            kick();
          }
        };
        document.addEventListener("visibilitychange", onVisibility);
        detachVisibility = () => document.removeEventListener("visibilitychange", onVisibility);

        intersectionObserver = new IntersectionObserver(
          (entries) => {
            visible = entries.some((entry) => entry.isIntersecting);
            if (visible) kick();
            else {
              window.cancelAnimationFrame(frame);
              frame = 0;
            }
          },
          { threshold: 0.05 }
        );
        intersectionObserver.observe(mount);

        syncRef.current = () => {
          if (motionAllowed()) kick();
          else {
            window.cancelAnimationFrame(frame);
            frame = 0;
          }
        };

        kick();
      } catch {
        tearDown();
      }
    };

    cancelIdle = scheduleIdle(boot);

    return () => {
      cancelled = true;
      tearDown();
    };
  }, []);

  return <div ref={mountRef} className="journey-scene__stage" aria-hidden="true" />;
}
