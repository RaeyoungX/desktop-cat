export type CatState = "walk" | "approach" | "sit" | "sleep" | "loaf" | "peek" | "box";

export const CAT_CANVAS_WIDTH = 160;
export const CAT_CANVAS_HEIGHT = 210;
export const CAT_SPRITE_HEIGHT = 160;

export type SpriteConfig = {
  src: string;
  frames: number;
  fps?: number;
  frameDurations?: number[];
};

export const CAT_SPRITE_CONFIGS: Record<string, SpriteConfig> = {
  walk: { src: "/assets/walk.png", frames: 4, fps: 8 },
  approach: { src: "/assets/walk.png", frames: 4, fps: 9 },
  sit: { src: "/assets/sit.png", frames: 2, frameDurations: [2800, 550] },
  sleep: { src: "/assets/sleep.png", frames: 2, frameDurations: [2000, 600] },
};

export const CAT_STATIC_SRCS: Record<string, string> = {
  loaf: "/assets/cat-loaf.png",
  peek: "/assets/cat-peek.png",
  box: "/assets/cat-box.png",
};
