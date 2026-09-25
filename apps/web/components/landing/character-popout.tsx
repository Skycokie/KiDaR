"use client";

import { forwardRef, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import Image, { type StaticImageData } from "next/image";

/** Homepage pop-out angles. Each source card is tilted differently. */
export type PopoutVariant = "red-dress" | "open-arms" | "green-shirt" | "rooster";

export const POPOUT_TILT: Record<PopoutVariant, string> = {
  "red-dress": "-5deg",
  "open-arms": "4deg",
  "green-shirt": "-4deg",
  "rooster": "5deg"
};

/**
 * Near-white paper becomes transparent so the figure can stand on the source
 * card. The source card itself keeps its white paper; this matte is only for
 * the character layer.
 */
function applyPaperMatte(rgba: Uint8ClampedArray): void {
  for (let index = 0; index < rgba.length; index += 4) {
    const dist = 255 - rgba[index]! + (255 - rgba[index + 1]!) + (255 - rgba[index + 2]!);
    const alpha = dist < 18 ? 0 : dist < 72 ? Math.round(((dist - 18) / 54) * 255) : 255;
    rgba[index + 3] = alpha;
  }
}

function cropToInk(source: ImageData): ImageData | null {
  const { width, height, data } = source;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3]! < 24) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < minX || maxY < minY) return null;
  const pad = 2;
  const x0 = Math.max(0, minX - pad);
  const y0 = Math.max(0, minY - pad);
  const x1 = Math.min(width - 1, maxX + pad);
  const y1 = Math.min(height - 1, maxY + pad);
  const cropWidth = x1 - x0 + 1;
  const cropHeight = y1 - y0 + 1;
  const cropped = new ImageData(cropWidth, cropHeight);
  for (let y = 0; y < cropHeight; y += 1) {
    const srcStart = ((y0 + y) * width + x0) * 4;
    cropped.data.set(data.subarray(srcStart, srcStart + cropWidth * 4), y * cropWidth * 4);
  }
  return cropped;
}

function PaperSticker({ src }: { src: StaticImageData }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    const image = new window.Image();
    image.decoding = "async";
    image.onload = () => {
      if (cancelled) return;
      const width = image.naturalWidth || src.width;
      const height = image.naturalHeight || src.height;
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return;
      context.clearRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
      try {
        const imageData = context.getImageData(0, 0, width, height);
        applyPaperMatte(imageData.data);
        const cropped = cropToInk(imageData);
        if (!cropped) return;
        canvas.width = cropped.width;
        canvas.height = cropped.height;
        const next = canvas.getContext("2d");
        next?.putImageData(cropped, 0, 0);
        setShown(true);
      } catch {
        setShown(true);
      }
    };
    image.src = src.src;
    return () => {
      cancelled = true;
    };
  }, [src]);

  return (
    <canvas
      ref={canvasRef}
      className="character-popout__sticker"
      data-shown={shown ? "true" : "false"}
      aria-hidden="true"
    />
  );
}

type CharacterPopoutProps = {
  variant: PopoutVariant;
  src: StaticImageData;
  sizes: string;
  priority?: boolean;
  loading?: "eager" | "lazy";
  phase?: "png" | "ready" | "failed";
  reveal?: "in" | "out";
  children?: ReactNode;
  onActivate?: () => void;
};

/**
 * Original drawing sits low and tilted. The character layer stands in front,
 * feet crossing the card's top edge. Children are an optional GLB viewer.
 */
export const CharacterPopout = forwardRef<HTMLDivElement, CharacterPopoutProps>(function CharacterPopout(
  { variant, src, sizes, priority = false, loading, phase = "png", reveal = "in", children, onActivate },
  ref
) {
  return (
    <div
      ref={ref}
      className={`character-popout character-popout--${variant}`}
      data-variant={variant}
      data-phase={phase}
      data-reveal={reveal}
      style={{ "--popout-tilt": POPOUT_TILT[variant] } as CSSProperties}
      aria-hidden="true"
      onPointerEnter={onActivate}
      onClick={onActivate}
    >
      <div className="character-popout__source" aria-hidden="true">
        <Image
          src={src}
          alt=""
          width={512}
          height={512}
          sizes={sizes}
          priority={priority}
          loading={priority ? undefined : loading}
        />
      </div>
      <div className="character-popout__shadow" aria-hidden="true" />
      <div className="character-popout__figure">
        <div className="character-popout__actor">
          <PaperSticker src={src} />
          {children}
        </div>
      </div>
    </div>
  );
});
