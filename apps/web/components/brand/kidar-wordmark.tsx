export const KIDAR_WORDMARK_LABEL = "kidAR — Play With Studio";

export function KidarWordmark({
  variant = "stack",
  labelled = true
}: {
  variant?: "stack" | "compact";
  /** False when a parent link already exposes the brand name. */
  labelled?: boolean;
}) {
  return (
    <span
      className={variant === "compact" ? "kidar-wordmark kidar-wordmark--compact" : "kidar-wordmark"}
      {...(labelled
        ? { role: "img" as const, "aria-label": KIDAR_WORDMARK_LABEL }
        : { "aria-hidden": true as const })}
    >
      <span className="kidar-wordmark__eyebrow">
        <span className="kidar-wordmark__play">PLAY</span>
        <span className="kidar-wordmark__with">WITH</span>
      </span>
      <span className="kidar-wordmark__name">kidAR</span>
      <span className="kidar-wordmark__subtitle">STUDIO</span>
    </span>
  );
}
