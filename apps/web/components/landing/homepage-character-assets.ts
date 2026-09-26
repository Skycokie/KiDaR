/**
 * Local homepage-only demo character assets (not product / FigureAssets schema).
 * Optimized Tripo staging GLBs from KiDaR landing illustrations.
 */

export type HomepageCharacterId =
  | "red-dress"
  | "open-arms"
  | "green-shirt"
  | "rooster"
  | "detective-yellow-coat"
  | "detective-red-haired-boy"
  | "detective-purple-girl"
  | "detective-curly-boy";

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
  },
  detectiveYellowCoat: {
    id: "detective-yellow-coat",
    kind: "demo-glb",
    glbSrc: "/demo/characters/detective-yellow-coat.glb",
    restYawRad: (3 * Math.PI) / 2
  },
  detectiveRedHairedBoy: {
    id: "detective-red-haired-boy",
    kind: "demo-glb",
    glbSrc: "/demo/characters/detective-red-haired-boy-happy.glb",
    restYawRad: (3 * Math.PI) / 2
  },
  detectivePurpleGirl: {
    id: "detective-purple-girl",
    kind: "demo-glb",
    glbSrc: "/demo/characters/detective-purple-girl-happy.glb",
    restYawRad: (3 * Math.PI) / 2
  },
  detectiveCurlyBoy: {
    id: "detective-curly-boy",
    kind: "demo-glb",
    glbSrc: "/demo/characters/detective-curly-boy-happy.glb",
    restYawRad: (3 * Math.PI) / 2
  }
} as const satisfies Record<string, HomepageCharacterDemo>;
