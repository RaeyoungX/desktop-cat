import {
  CAT_CANVAS_HEIGHT,
  CAT_CANVAS_WIDTH,
  CAT_SPRITE_CONFIGS,
  CAT_SPRITE_HEIGHT,
  type CatState,
} from "./catSprites";

export const WALK_SPEED = 1.5;
export const TRANSITION_MS = 300;

export const TRANSITIONS: Record<string, Array<{ state: CatState; weight: number }>> = {
  walk: [
    { state: "sit", weight: 42 },
    { state: "loaf", weight: 20 },
    { state: "peek", weight: 12 },
    { state: "box", weight: 6 },
    { state: "walk", weight: 20 },
  ],
  sit: [
    { state: "walk", weight: 40 },
    { state: "sleep", weight: 28 },
    { state: "loaf", weight: 16 },
    { state: "peek", weight: 10 },
    { state: "sit", weight: 6 },
  ],
  sleep: [{ state: "sit", weight: 80 }, { state: "walk", weight: 12 }, { state: "sleep", weight: 8 }],
  loaf: [{ state: "walk", weight: 36 }, { state: "sleep", weight: 28 }, { state: "sit", weight: 24 }, { state: "peek", weight: 12 }],
  peek: [{ state: "sit", weight: 50 }, { state: "walk", weight: 50 }],
  box: [{ state: "sit", weight: 50 }, { state: "walk", weight: 30 }, { state: "sleep", weight: 20 }],
};

export const STATE_DURATION: Record<CatState, { min: number; max: number }> = {
  walk: { min: 5000, max: 14000 },
  approach: { min: 4000, max: 12000 },
  sit: { min: 5000, max: 14000 },
  sleep: { min: 18000, max: 50000 },
  loaf: { min: 8000, max: 20000 },
  peek: { min: 3000, max: 7000 },
  box: { min: 10000, max: 25000 },
};

export const IDLE_LINES = ["喵。", "继续哦。", "我在巡逻。", "别走神啦。"];

export function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function nextState(current: CatState, random = Math.random()): CatState {
  const options = TRANSITIONS[current] ?? [{ state: "walk", weight: 1 }];
  const total = options.reduce((sum, option) => sum + option.weight, 0);
  let cursor = random * total;
  for (const option of options) {
    cursor -= option.weight;
    if (cursor <= 0) return option.state;
  }
  return options[0].state;
}

export function fixedFrameForState(state: CatState, random = Math.random()): number | null {
  if (state !== "sit") return null;
  return Math.floor(random * (CAT_SPRITE_CONFIGS.sit?.frames ?? 1));
}

export function alertTargetForCursor(
  cursor: { x: number; y: number },
  bounds: { screenW: number; screenH: number; originX: number; originY: number },
): { x: number; y: number } {
  return {
    x: Math.max(0, Math.min(bounds.screenW - CAT_CANVAS_WIDTH, cursor.x - bounds.originX - CAT_CANVAS_WIDTH / 2)),
    y: Math.max(0, Math.min(bounds.screenH - CAT_SPRITE_HEIGHT, cursor.y - bounds.originY - CAT_SPRITE_HEIGHT / 2)),
  };
}

export function groundAfterDrag(catY: number, screenH: number): number {
  return Math.max(0, Math.min(screenH - CAT_CANVAS_HEIGHT, catY));
}
