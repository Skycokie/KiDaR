import { forwardRef, type CSSProperties, type ReactNode } from "react";
import Image, { type StaticImageData } from "next/image";

/** Homepage pop-out angles. Each source card is tilted differently. */
export type PopoutVariant = "red-dress" | "open-arms" | "green-shirt" | "rooster";

export const POPOUT_TILT: Record<PopoutVariant, string> = {
  "red-dress": "-5deg",
  "open-arms": "4deg",
  "green-shirt": "-4deg",
  rooster: "5deg"
};

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
  onClickActivate?: () => void;
};

/**
 * Original drawing card only. No suspended PNG sticker.
 * Children render the optional GLB viewer on hover/click.
 */
export const CharacterPopout = forwardRef<HTMLDivElement, CharacterPopoutProps>(function CharacterPopout(
  {
    variant,
    src,
    sizes,
    priority = false,
    loading,
    phase = "png",
    reveal = "in",
    children,
    onActivate,
    onClickActivate
  },
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
      onClick={onClickActivate ?? onActivate}
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
        <div className="character-popout__actor">{children}</div>
      </div>
    </div>
  );
});
