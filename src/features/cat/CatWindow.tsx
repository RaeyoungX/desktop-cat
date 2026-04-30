import { useEffect, useRef } from "react";

const CAT_W = 160;
const CAT_H = 160;
const CANVAS_H = 210;
const WALK_SPEED = 1.5;

type CatState = "walk" | "approach" | "sit" | "sleep" | "loaf" | "peek" | "box";
type ProcessedSprite = {
  canvas: HTMLCanvasElement;
  frameW: number;
  frameH: number;
};

const STATE_DURATION: Record<CatState, { min: number; max: number }> = {
  walk: { min: 3000, max: 8500 },
  approach: { min: 4000, max: 12000 },
  sit: { min: 4500, max: 11000 },
  sleep: { min: 9000, max: 20000 },
  loaf: { min: 6500, max: 15000 },
  peek: { min: 2500, max: 6000 },
  box: { min: 7000, max: 16000 },
};

const TRANSITIONS: Record<string, Array<{ state: CatState; weight: number }>> = {
  walk: [
    { state: "sit", weight: 32 },
    { state: "loaf", weight: 20 },
    { state: "peek", weight: 18 },
    { state: "box", weight: 10 },
    { state: "sleep", weight: 8 },
    { state: "walk", weight: 12 },
  ],
  sit: [
    { state: "walk", weight: 42 },
    { state: "sleep", weight: 20 },
    { state: "loaf", weight: 18 },
    { state: "peek", weight: 14 },
    { state: "box", weight: 6 },
  ],
  sleep: [{ state: "sit", weight: 70 }, { state: "loaf", weight: 15 }, { state: "walk", weight: 15 }],
  loaf: [{ state: "walk", weight: 38 }, { state: "sleep", weight: 22 }, { state: "sit", weight: 22 }, { state: "peek", weight: 18 }],
  peek: [{ state: "sit", weight: 30 }, { state: "walk", weight: 55 }, { state: "loaf", weight: 15 }],
  box: [{ state: "sit", weight: 42 }, { state: "walk", weight: 35 }, { state: "sleep", weight: 23 }],
};

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function nextState(state: CatState): CatState {
  const options = TRANSITIONS[state] ?? TRANSITIONS.walk;
  const total = options.reduce((sum, item) => sum + item.weight, 0);
  let cursor = Math.random() * total;
  for (const option of options) {
    cursor -= option.weight;
    if (cursor <= 0) return option.state;
  }
  return options[0].state;
}

function useImage(src: string): HTMLImageElement {
  const img = new Image();
  img.src = src;
  return img;
}

function loadTransparentSprite(src: string, frames: number): Promise<ProcessedSprite> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) {
        resolve({ canvas, frameW: img.naturalWidth / frames, frameH: img.naturalHeight });
        return;
      }

      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        const whiteness = Math.min(data[i], data[i + 1], data[i + 2]);
        if (whiteness > 180) {
          data[i + 3] = Math.round(255 * Math.max(0, 1 - (whiteness - 180) / 75));
        }
      }
      ctx.putImageData(imageData, 0, 0);
      resolve({ canvas, frameW: img.naturalWidth / frames, frameH: img.naturalHeight });
    };
    img.src = src;
  });
}

export function CatWindow() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const bubbleRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    document.body.classList.add("cat-route");
    return () => document.body.classList.remove("cat-route");
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const bubbleNode = bubbleRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context || !bubbleNode) return;
    if (!window.cat) return;
    const ctx = context;
    const bubble = bubbleNode;

    let catX = 0;
    let catY = 0;
    let screenW = 1920;
    let screenH = 1080;
    let originX = 0;
    let originY = 0;
    let dir = 1;
    let state: CatState = "walk";
    let stateUntil = Date.now() + rand(3000, 8000);
    let approachTargetX = 0;
    let approachTargetY = 0;
    let lastX = -1;
    let lastY = -1;
    let cursorX = -9999;
    let cursorY = -9999;
    let alertLocked = false;
    let equipped: string[] = [];
    let animation = 0;
    let bubbleTimer: ReturnType<typeof setTimeout> | null = null;
    let lastIgnore = true;
    let cancelled = false;

    const images = {
      loaf: useImage("/assets/cat-loaf.png"),
      peek: useImage("/assets/cat-peek.png"),
      box: useImage("/assets/cat-box.png"),
    };
    const sprites: Partial<Record<"walk" | "sit" | "sleep", ProcessedSprite>> = {};

    function showBubble(text: string, ms = 3200) {
      if (bubbleTimer) clearTimeout(bubbleTimer);
      bubble.textContent = text;
      bubble.classList.add("show");
      bubbleTimer = setTimeout(() => bubble.classList.remove("show"), ms);
    }

    function setState(next: CatState) {
      if (state === next) return;
      state = next;
      const duration = STATE_DURATION[next];
      stateUntil = Date.now() + rand(duration.min, duration.max);
      if ((next === "sit" || next === "sleep" || next === "loaf") && Math.random() < 0.05) {
        showBubble(["喵。", "继续哦。", "我在巡逻。"][Math.floor(Math.random() * 3)]);
      }
    }

    function drawImageForState(timestamp: number) {
      ctx.clearRect(0, 0, CAT_W, CANVAS_H);
      ctx.save();
      if (dir === -1) {
        ctx.translate(CAT_W, 0);
        ctx.scale(-1, 1);
      }

      if (state === "walk" || state === "approach") {
        const sprite = sprites.walk;
        const frames = 4;
        const frame = Math.floor(timestamp / 120) % frames;
        if (sprite) {
          ctx.drawImage(sprite.canvas, frame * sprite.frameW, 0, sprite.frameW, sprite.frameH, 6, CANVAS_H - CAT_H, CAT_W - 12, CAT_H);
        }
      } else {
        const sprite = state === "sit" ? sprites.sit : state === "sleep" ? sprites.sleep : null;
        const image = state !== "sit" && state !== "sleep" ? images[state] : null;
        if (sprite) {
          ctx.drawImage(sprite.canvas, 0, 0, sprite.frameW, sprite.frameH, 0, CANVAS_H - CAT_H, CAT_W, CAT_H);
        } else if (image?.complete && image.naturalWidth) {
          ctx.drawImage(image, 0, CANVAS_H - CAT_H, CAT_W, CAT_H);
        }
      }

      ctx.restore();
      if (equipped.includes("hat")) drawEmoji("🎩", CAT_W / 2, 42, 22);
      if (equipped.includes("crown")) drawEmoji("👑", CAT_W / 2, 42, 22);
      if (equipped.includes("bow")) drawEmoji("🎀", CAT_W / 2 + 28, 88, 17);
      if (equipped.includes("glasses")) drawEmoji("🕶️", CAT_W / 2, 74, 16);
      if (equipped.includes("stars") && Math.floor(timestamp / 300) % 2 === 0) drawEmoji("✨", 36 + Math.random() * 88, 54 + Math.random() * 55, 12);
    }

    function drawEmoji(text: string, x: number, y: number, size: number) {
      ctx.save();
      ctx.font = `${size}px serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, x, y);
      ctx.restore();
    }

    function isOverCat(x: number, y: number): boolean {
      if (x < 0 || y < 0 || x >= CAT_W || y >= CANVAS_H) return false;
      const alpha = ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data[3];
      return alpha > 30;
    }

    function tick(timestamp: number) {
      const now = Date.now();
      if (state === "walk") {
        catX += WALK_SPEED * dir;
        catY = screenH - CAT_H;
        if (catX <= 0) {
          catX = 0;
          dir = 1;
        }
        if (catX >= screenW - CAT_W) {
          catX = screenW - CAT_W;
          dir = -1;
        }
        if (!alertLocked && now > stateUntil) {
          const cursorLocalX = cursorX - originX;
          if (cursorLocalX > 0 && cursorLocalX < screenW && Math.random() < 0.25) {
            approachTargetX = Math.max(0, Math.min(screenW - CAT_W, cursorLocalX - CAT_W / 2));
            approachTargetY = screenH - CAT_H;
            setState("approach");
          } else {
            setState(nextState("walk"));
          }
        }
      } else if (state === "approach") {
        const dx = approachTargetX - catX;
        const dy = approachTargetY - catY;
        const dist = Math.hypot(dx, dy);
        if (dist < 8) {
          catX = approachTargetX;
          catY = approachTargetY;
          setState("sit");
          if (alertLocked) {
            stateUntil = Number.POSITIVE_INFINITY;
          }
        } else {
          const speed = WALK_SPEED * 1.7;
          catX += (dx / dist) * speed;
          catY += (dy / dist) * speed;
          dir = dx >= 0 ? 1 : -1;
        }
      } else if (!alertLocked && now > stateUntil) {
        catY = screenH - CAT_H;
        setState(nextState(state));
      }

      drawImageForState(timestamp);
      const rx = Math.round(catX);
      const ry = Math.round(catY);
      if (rx !== lastX || ry !== lastY) {
        window.cat.move({ x: rx + originX, y: ry + originY });
        lastX = rx;
        lastY = ry;
      }
      animation = requestAnimationFrame(tick);
    }

    const cleanupCursor = window.cat.onCursor((pos) => {
      cursorX = pos.x;
      cursorY = pos.y;
    });
    const cleanupComeHere = window.cat.onComeHere((cursor) => {
      alertLocked = true;
      approachTargetX = Math.max(0, Math.min(screenW - CAT_W, cursor.x - originX - CAT_W / 2));
      approachTargetY = Math.max(0, Math.min(screenH - CAT_H, cursor.y - originY - CAT_H / 2));
      setState("approach");
      showBubble("喵，在干嘛呢？", 4000);
    });
    const cleanupResume = window.cat.onResumeWander(() => {
      alertLocked = false;
      catY = screenH - CAT_H;
      setState("walk");
    });
    const cleanupBubble = window.cat.onShowBubble((text) => showBubble(text));
    const cleanupEquip = window.cat.onEquipItems((items) => {
      equipped = items;
    });

    const mouseMove = (event: MouseEvent) => {
      const over = isOverCat(event.clientX, event.clientY);
      if (over !== !lastIgnore) {
        lastIgnore = !over;
        window.cat.setMouseIgnore(!over);
      }
    };
    const click = () => showBubble(["喵？", "别戳啦。", "继续专注。"][Math.floor(Math.random() * 3)], 1800);

    window.addEventListener("mousemove", mouseMove);
    canvas.addEventListener("click", click);

    void Promise.all([
      loadTransparentSprite("/assets/walk.png", 4),
      loadTransparentSprite("/assets/sit.png", 1),
      loadTransparentSprite("/assets/sleep.png", 2),
      window.cat.getScreenSize(),
    ]).then(([walk, sit, sleep, size]) => {
      if (cancelled) return;
      sprites.walk = walk;
      sprites.sit = sit;
      sprites.sleep = sleep;
      screenW = size.width;
      screenH = size.height;
      originX = size.originX || 0;
      originY = size.originY || 0;
      catX = Math.floor(screenW / 2 - CAT_W / 2);
      catY = screenH - CAT_H;
      animation = requestAnimationFrame(tick);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(animation);
      cleanupCursor();
      cleanupComeHere();
      cleanupResume();
      cleanupBubble();
      cleanupEquip();
      window.removeEventListener("mousemove", mouseMove);
      canvas.removeEventListener("click", click);
      if (bubbleTimer) clearTimeout(bubbleTimer);
    };
  }, []);

  return (
    <div className="cat-window">
      <div ref={bubbleRef} className="cat-bubble" />
      <canvas ref={canvasRef} width={CAT_W} height={CANVAS_H} />
    </div>
  );
}
