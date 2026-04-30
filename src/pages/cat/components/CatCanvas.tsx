import { useEffect, useRef } from "react";
import { useCatRouteClass } from "../hooks/useCatRouteClass";

const CAT_W = 160;
const CAT_H = 160;
const CANVAS_H = 210;
const WALK_SPEED = 1.5;
const TRANSITION_MS = 300;

type CatState = "walk" | "approach" | "sit" | "sleep" | "loaf" | "peek" | "box";

type SpriteConfig = {
  src: string;
  frames: number;
  fps?: number;
  frameDurations?: number[];
};

type SpriteData = {
  canvas: HTMLCanvasElement;
  frameW: number;
  crop: {
    minY: number;
    cropH: number;
    minX: number;
    cropW: number;
  };
};

const TRANSITIONS: Record<string, Array<{ state: CatState; weight: number }>> = {
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

const STATE_DURATION: Record<CatState, { min: number; max: number }> = {
  walk: { min: 5000, max: 14000 },
  approach: { min: 4000, max: 12000 },
  sit: { min: 5000, max: 14000 },
  sleep: { min: 18000, max: 50000 },
  loaf: { min: 8000, max: 20000 },
  peek: { min: 3000, max: 7000 },
  box: { min: 10000, max: 25000 },
};

const SPRITE_CONFIGS: Record<string, SpriteConfig> = {
  walk: { src: "/assets/walk.png", frames: 4, fps: 8 },
  approach: { src: "/assets/walk.png", frames: 4, fps: 9 },
  sit: { src: "/assets/sit.png", frames: 1 },
  sleep: { src: "/assets/sleep.png", frames: 2, frameDurations: [2000, 600] },
};

const STATIC_SRCS: Record<string, string> = {
  loaf: "/assets/cat-loaf.png",
  peek: "/assets/cat-peek.png",
  box: "/assets/cat-box.png",
};

const IDLE_LINES = ["喵。", "继续哦。", "我在巡逻。", "别走神啦。"];

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function nextState(current: CatState): CatState {
  const options = TRANSITIONS[current] ?? [{ state: "walk", weight: 1 }];
  const total = options.reduce((sum, option) => sum + option.weight, 0);
  let cursor = Math.random() * total;
  for (const option of options) {
    cursor -= option.weight;
    if (cursor <= 0) return option.state;
  }
  return options[0].state;
}

function loadSprite(src: string, frames: number): Promise<SpriteData> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const frameW = Math.floor(img.naturalWidth / frames);
      const oc = document.createElement("canvas");
      oc.width = img.naturalWidth;
      oc.height = img.naturalHeight;
      const oc2 = oc.getContext("2d", { willReadFrequently: true });
      if (!oc2) {
        resolve({
          canvas: oc,
          frameW,
          crop: { minY: 0, cropH: img.naturalHeight, minX: 0, cropW: frameW },
        });
        return;
      }

      oc2.drawImage(img, 0, 0);
      const imageData = oc2.getImageData(0, 0, oc.width, oc.height);
      const data = imageData.data;
      let minY = oc.height;
      let maxY = 0;

      for (let i = 0; i < data.length; i += 4) {
        const whiteness = Math.min(data[i], data[i + 1], data[i + 2]);
        if (whiteness > 180) {
          data[i + 3] = Math.round(255 * Math.max(0, 1 - (whiteness - 180) / 75));
        }
        if (data[i + 3] > 20) {
          const y = Math.floor((i / 4) / oc.width);
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
      oc2.putImageData(imageData, 0, 0);

      let minX = frameW;
      let maxX = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] > 20) {
          const localX = ((i / 4) % oc.width) % frameW;
          if (localX < minX) minX = localX;
          if (localX > maxX) maxX = localX;
        }
      }

      const pad = 8;
      const cropMinY = Math.max(0, minY - pad);
      const cropH = Math.min(oc.height, maxY + pad) - cropMinY;
      const cropMinX = Math.max(0, minX - pad);
      const cropW = Math.min(frameW, maxX + pad) - cropMinX;

      resolve({
        canvas: oc,
        frameW,
        crop: {
          minY: cropMinY,
          cropH: Math.max(1, cropH),
          minX: cropMinX,
          cropW: Math.max(1, cropW),
        },
      });
    };
    img.src = src;
  });
}

function loadImage(src: string): HTMLImageElement {
  const img = new Image();
  img.src = src;
  return img;
}

export function CatCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const bubbleRef = useRef<HTMLDivElement | null>(null);

  useCatRouteClass();

  useEffect(() => {
    const canvas = canvasRef.current;
    const bubbleNode = bubbleRef.current;
    const canvasContext = canvas?.getContext("2d", { willReadFrequently: true });
    if (!canvas || !bubbleNode || !canvasContext || !window.cat) return;
    const bubble = bubbleNode;
    const ctx = canvasContext;

    let catX = 0;
    let catY = 0;
    let screenW = 1920;
    let screenH = 1080;
    let originX = 0;
    let originY = 0;
    let dir = 1;
    let cursorX = -9999;
    let state: CatState = "walk";
    let stateUntil = Date.now() + rand(4000, 12000);
    let approachTargetX = 0;
    let approachTargetY = 0;
    let lastX = -1;
    let lastY = -1;
    let currentFrame = 0;
    let lastFrameMs = 0;
    let prevState: CatState | null = null;
    let transitionStart = 0;
    let transitionAlpha = 1;
    let alertLocked = false;
    let equippedItems: string[] = [];
    let lastDrawnDH = 100;
    let starParticles: Array<{ x: number; y: number; life: number; decay: number; vx: number; vy: number }> = [];
    let animation = 0;
    let bubbleTimer: ReturnType<typeof setTimeout> | null = null;
    let lastIgnore = true;
    let cancelled = false;

    const sprites: Record<string, SpriteData> = {};
    const staticImgs: Record<string, HTMLImageElement> = {};

    function showBubble(text: string, durationMs = 3000) {
      if (bubbleTimer) clearTimeout(bubbleTimer);
      bubble.textContent = text;
      bubble.classList.add("show");
      bubbleTimer = setTimeout(() => {
        bubble.classList.remove("show");
        bubbleTimer = null;
      }, durationMs);
    }

    function setState(next: CatState) {
      if (next === state) return;
      prevState = state;
      transitionStart = performance.now();
      transitionAlpha = 0;
      state = next;
      currentFrame = 0;
      lastFrameMs = 0;
      const duration = STATE_DURATION[next] ?? { min: 4000, max: 10000 };
      stateUntil = Date.now() + rand(duration.min, duration.max);
      if ((next === "sit" || next === "sleep" || next === "loaf") && Math.random() < 0.05) {
        setTimeout(() => showBubble(IDLE_LINES[Math.floor(Math.random() * IDLE_LINES.length)]), 800);
      }
    }

    function drawSprite(spriteData: SpriteData, frame: number) {
      const { canvas: spriteCanvas, frameW, crop } = spriteData;
      const srcW = crop.cropW || frameW;
      const scale = Math.min(CAT_W / srcW, CAT_H / crop.cropH);
      const dw = srcW * scale;
      const dh = crop.cropH * scale;
      lastDrawnDH = dh;
      ctx.drawImage(
        spriteCanvas,
        frame * frameW + (crop.minX || 0),
        crop.minY,
        srcW,
        crop.cropH,
        (CAT_W - dw) / 2,
        CANVAS_H - dh,
        dw,
        dh,
      );
    }

    function drawState(drawStateName: CatState, alpha: number) {
      const cfg = SPRITE_CONFIGS[drawStateName];
      const spriteData = sprites[drawStateName];
      ctx.save();
      ctx.globalAlpha = alpha;
      if (dir === -1) {
        ctx.translate(CAT_W, 0);
        ctx.scale(-1, 1);
      }
      if (cfg && spriteData) {
        drawSprite(spriteData, drawStateName === state ? currentFrame : 0);
      } else {
        const img = staticImgs[drawStateName];
        if (img && img.complete && img.naturalWidth > 0) {
          ctx.drawImage(img, 0, CANVAS_H - CAT_H, CAT_W, CAT_H);
          lastDrawnDH = CAT_H;
        }
      }
      ctx.restore();
    }

    function drawAccessories() {
      if (equippedItems.length === 0) return;
      const headX = CAT_W / 2;
      const spriteTop = CAT_H - lastDrawnDH;
      const headY = spriteTop + lastDrawnDH * 0.13;
      ctx.save();
      if (dir === -1) {
        ctx.translate(CAT_W, 0);
        ctx.scale(-1, 1);
      }
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (const item of equippedItems) {
        if (item === "hat") {
          ctx.font = "22px serif";
          ctx.fillText("🎩", headX, headY - 14);
        } else if (item === "crown") {
          ctx.font = "20px serif";
          ctx.fillText("👑", headX, headY - 12);
        } else if (item === "bow") {
          ctx.font = "16px serif";
          ctx.fillText("🎀", headX + 22, headY + lastDrawnDH * 0.28);
        } else if (item === "glasses") {
          ctx.font = "14px serif";
          ctx.fillText("🕶️", headX, headY + lastDrawnDH * 0.16);
        }
      }
      ctx.restore();
    }

    function updateStarParticles() {
      if (!equippedItems.includes("stars")) {
        starParticles = [];
        return;
      }
      if (Math.random() < 0.04) {
        starParticles.push({
          x: CAT_W / 2 + (Math.random() - 0.5) * 50,
          y: CAT_H - lastDrawnDH * (0.15 + Math.random() * 0.7),
          life: 1,
          decay: 0.014 + Math.random() * 0.008,
          vy: -0.5 - Math.random() * 0.4,
          vx: (Math.random() - 0.5) * 0.4,
        });
      }
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (let i = starParticles.length - 1; i >= 0; i -= 1) {
        const p = starParticles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= p.decay;
        if (p.life <= 0) {
          starParticles.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.globalAlpha = p.life * 0.9;
        ctx.font = "11px serif";
        ctx.fillText("✨", p.x, p.y);
        ctx.restore();
      }
    }

    function draw(timestamp: number) {
      ctx.clearRect(0, 0, CAT_W, CANVAS_H);
      if (transitionAlpha < 1) {
        transitionAlpha = Math.min(1, (timestamp - transitionStart) / TRANSITION_MS);
      }
      const cfg = SPRITE_CONFIGS[state];
      if (cfg) {
        const duration = cfg.frameDurations ? cfg.frameDurations[currentFrame] : 1000 / (cfg.fps ?? 8);
        if (timestamp - lastFrameMs > duration) {
          currentFrame = (currentFrame + 1) % cfg.frames;
          lastFrameMs = timestamp;
        }
      }
      if (prevState && transitionAlpha < 1) {
        drawState(prevState, 1 - transitionAlpha);
      }
      drawState(state, transitionAlpha);
      drawAccessories();
      updateStarParticles();
    }

    function isOverCat(x: number, y: number): boolean {
      if (x < 0 || y < 0 || x >= CAT_W || y >= CANVAS_H) return false;
      return ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data[3] > 30;
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
          const cursorScreenX = cursorLocalX - CAT_W / 2;
          const inRange = cursorLocalX > 0 && cursorLocalX < screenW;
          if (inRange && Math.random() < 0.35) {
            approachTargetX = Math.max(0, Math.min(screenW - CAT_W, cursorScreenX));
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
          if (alertLocked) stateUntil = Number.POSITIVE_INFINITY;
        } else {
          const speed = WALK_SPEED * (alertLocked ? 2 : 1.5);
          catX += (dx / dist) * speed;
          catY += (dy / dist) * speed;
          dir = dx >= 0 ? 1 : -1;
        }
      } else if (!alertLocked && now > stateUntil) {
        catY = screenH - CAT_H;
        setState(nextState(state));
      }

      draw(timestamp);
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
    const cleanupBubble = window.cat.onShowBubble((text) => showBubble(text, 3500));
    const cleanupEquip = window.cat.onEquipItems((items) => {
      equippedItems = items;
    });

    const onMouseMove = (event: MouseEvent) => {
      const over = isOverCat(event.clientX, event.clientY);
      if (over !== !lastIgnore) {
        lastIgnore = !over;
        window.cat.setMouseIgnore(!over);
      }
    };
    const onClick = () => {
      showBubble(["喵？", "别戳啦。", "继续专注。"][Math.floor(Math.random() * 3)], 1800);
    };
    window.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("click", onClick);

    void Promise.all([
      window.cat.getScreenSize(),
      ...Object.entries(SPRITE_CONFIGS).map(async ([key, cfg]) => {
        const sprite = sprites[cfg.src] ?? await loadSprite(cfg.src, cfg.frames);
        sprites[cfg.src] = sprite;
        sprites[key] = sprite;
      }),
    ]).then(([size]) => {
      if (cancelled) return;
      screenW = size.width;
      screenH = size.height;
      originX = size.originX || 0;
      originY = size.originY || 0;
      catX = Math.floor(screenW / 2 - CAT_W / 2);
      catY = screenH - CAT_H;
      for (const [key, src] of Object.entries(STATIC_SRCS)) {
        staticImgs[key] = loadImage(src);
      }
      setState("walk");
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
      window.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("click", onClick);
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
