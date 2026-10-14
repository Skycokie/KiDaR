/** Local story stills for `/creaza` WHO / WHAT / WHERE cards. */

export const STARTING_POINT_ART = {
  who: {
    src: "/demo/creaza/who-story-card.webp",
    width: 768,
    height: 1024
  },
  what: {
    src: "/demo/creaza/what-story-card.webp",
    width: 768,
    height: 1024
  },
  where: {
    src: "/demo/creaza/where-story-card.webp",
    width: 768,
    height: 1024
  }
} as const;

export type StartingPointArtKind = keyof typeof STARTING_POINT_ART;
