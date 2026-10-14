/** Pointer orbit for the shared homepage / `/creaza` GLB overlay. No second viewer. */

export const GLB_ORBIT_RAD_PER_PX = 0.0055;
export const GLB_ORBIT_PITCH_MAX = Math.PI / 2 - 0.08;
export const GLB_ORBIT_DRAG_PX = 4;

export function glbOrbitFromPointer(dx: number, dy: number): { yaw: number; pitch: number } {
  return {
    yaw: dx * GLB_ORBIT_RAD_PER_PX,
    pitch: dy * GLB_ORBIT_RAD_PER_PX
  };
}

export function clampGlbOrbitPitch(pitch: number): number {
  return Math.max(-GLB_ORBIT_PITCH_MAX, Math.min(GLB_ORBIT_PITCH_MAX, pitch));
}

export function attachGlbPointerOrbit(
  target: HTMLElement,
  options: {
    getYaw: () => number;
    getPitch: () => number;
    setOrbit: (yaw: number, pitch: number) => void;
    onPaint: () => void;
    onDragStart?: () => void;
    onDragEnd?: () => void;
    onIdleClick?: () => void;
  }
): () => void {
  let pointerId: number | null = null;
  let lastX = 0;
  let lastY = 0;
  let moved = false;
  let yaw = 0;
  let pitch = 0;

  const onDown = (event: PointerEvent) => {
    if (pointerId !== null) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    pointerId = event.pointerId;
    lastX = event.clientX;
    lastY = event.clientY;
    moved = false;
    yaw = options.getYaw();
    pitch = options.getPitch();
    target.setPointerCapture(event.pointerId);
    target.style.cursor = "grabbing";
    options.onDragStart?.();
    event.preventDefault();
    event.stopPropagation();
  };

  const onMove = (event: PointerEvent) => {
    if (pointerId !== event.pointerId) return;
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    if (!moved && Math.hypot(dx, dy) < GLB_ORBIT_DRAG_PX) return;
    moved = true;
    lastX = event.clientX;
    lastY = event.clientY;
    const delta = glbOrbitFromPointer(dx, dy);
    yaw += delta.yaw;
    pitch = clampGlbOrbitPitch(pitch + delta.pitch);
    options.setOrbit(yaw, pitch);
    options.onPaint();
  };

  const onEnd = (event: PointerEvent) => {
    if (pointerId !== event.pointerId) return;
    pointerId = null;
    target.style.cursor = "grab";
    if (target.hasPointerCapture(event.pointerId)) {
      target.releasePointerCapture(event.pointerId);
    }
    options.onDragEnd?.();
    if (!moved) options.onIdleClick?.();
  };

  target.style.touchAction = "none";
  target.style.cursor = "grab";
  target.style.pointerEvents = "auto";
  target.addEventListener("pointerdown", onDown);
  target.addEventListener("pointermove", onMove);
  target.addEventListener("pointerup", onEnd);
  target.addEventListener("pointercancel", onEnd);

  return () => {
    target.removeEventListener("pointerdown", onDown);
    target.removeEventListener("pointermove", onMove);
    target.removeEventListener("pointerup", onEnd);
    target.removeEventListener("pointercancel", onEnd);
  };
}
