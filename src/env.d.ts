/// <reference types="vite/client" />

import type { DesktopCatApi } from "../electron/preload";

declare global {
  interface Window {
    desktopCat: DesktopCatApi;
    cat: Pick<DesktopCatApi["cat"], "onCursor" | "onComeHere" | "onResumeWander" | "onEquipItems" | "onShowBubble" | "move" | "getScreenSize" | "setMouseIgnore">;
  }
}

export {};
