/**
 * Local homepage-only demo character assets (not product / FigureAssets schema).
 * Optimized Tripo staging GLBs from KiDaR landing illustrations.
 */

export type HomepageCharacterId = "red-dress" | "open-arms" | "green-shirt" | "rooster";

export type HomepageCharacterDemo = {
  id: HomepageCharacterId;
  kind: "demo-glb";
  glbSrc: string;
  /** Viewer rest yaw that faces the character toward the camera. */
  restYawRad: number;
};

export const HOMEPAGE_DEMO_CHARACTERS = {
  redDress: {
    id: "red-dress",
    kind: "demo-glb",
    glbSrc: "/demo/characters/hero-red-dress.glb",
    restYawRad: Math.PI
  },
  openArms: {
    id: "open-arms",
    kind: "demo-glb",
    glbSrc: "/demo/characters/child-open-arms.glb",
    restYawRad: (3 * Math.PI) / 2
  },
  greenShirt: {
    id: "green-shirt",
    kind: "demo-glb",
    glbSrc: "/demo/characters/child-green-shirt.glb",
    restYawRad: (3 * Math.PI) / 2
  },
  rooster: {
    id: "rooster",
    kind: "demo-glb",
    glbSrc: "/demo/rooster/rooster.glb",
    restYawRad: (28 * Math.PI) / 180
  }
} as const satisfies Record<string, HomepageCharacterDemo>;
