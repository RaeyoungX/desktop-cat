import { useRef } from "react";
import { CAT_CANVAS_HEIGHT, CAT_CANVAS_WIDTH } from "../catSprites";
import { useCatAnimation } from "../hooks/useCatAnimation";
import { useCatRouteClass } from "../hooks/useCatRouteClass";

export function CatCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const bubbleRef = useRef<HTMLDivElement | null>(null);

  useCatRouteClass();
  useCatAnimation({ bubbleRef, canvasRef });

  return (
    <div className="cat-window">
      <div ref={bubbleRef} className="cat-bubble" />
      <canvas ref={canvasRef} width={CAT_CANVAS_WIDTH} height={CAT_CANVAS_HEIGHT} />
    </div>
  );
}
