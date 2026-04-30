import { contextBridge, ipcRenderer } from "electron";
import type { ActiveSession, FocusSession, TimelineEntry, TodayTask } from "../../src/shared/types";

type Listener<T> = (payload: T) => void;

function onChannel<T>(channel: string, cb: Listener<T>): () => void {
  const listener = (_: Electron.IpcRendererEvent, payload: T) => cb(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

const api = {
  tasks: {
    list: (): Promise<TodayTask[]> => ipcRenderer.invoke("tasks:list"),
    save: (tasks: TodayTask[]): Promise<TodayTask[]> => ipcRenderer.invoke("tasks:save", tasks),
  },
  sessions: {
    start: (task: { name: string; duration: number }): Promise<ActiveSession> => ipcRenderer.invoke("session:start", task),
    end: (payload?: { completedTaskId?: string | null }): Promise<FocusSession | null> => ipcRenderer.invoke("session:end", payload ?? {}),
    get: (): Promise<ActiveSession | null> => ipcRenderer.invoke("session:get"),
    list: (): Promise<FocusSession[]> => ipcRenderer.invoke("sessions:list"),
    timeline: (): Promise<TimelineEntry[]> => ipcRenderer.invoke("timeline:list"),
  },
  cat: {
    move: (pos: { x: number; y: number }): void => ipcRenderer.send("cat:move", pos),
    getScreenSize: (): Promise<{ width: number; height: number; originX: number; originY: number }> => ipcRenderer.invoke("screen:size"),
    setMouseIgnore: (value: boolean): void => ipcRenderer.send("cat:set-mouse-ignore", value),
    equipItems: (items: string[]): Promise<string[]> => ipcRenderer.invoke("cat:equip-items", items),
    getEquipped: (): Promise<string[]> => ipcRenderer.invoke("cat:get-equipped"),
    onCursor: (cb: Listener<{ x: number; y: number }>): (() => void) => onChannel("cat:cursor", cb),
    onComeHere: (cb: Listener<{ x: number; y: number }>): (() => void) => onChannel("cat:come-here", cb),
    onResumeWander: (cb: Listener<void>): (() => void) => onChannel("cat:resume-wander", cb),
    onEquipItems: (cb: Listener<string[]>): (() => void) => onChannel("cat:equip-items", cb),
    onShowBubble: (cb: Listener<string>): (() => void) => onChannel("cat:show-bubble", cb),
  },
  app: {
    closeDashboard: (): void => ipcRenderer.send("app:close-dashboard"),
    openDashboard: (): void => ipcRenderer.send("app:open-dashboard"),
    quit: (): void => ipcRenderer.send("app:quit"),
  },
  auth: {
    session: (): Promise<unknown> => ipcRenderer.invoke("auth:session"),
    signup: (payload: { email: string; password: string }): Promise<unknown> => ipcRenderer.invoke("auth:signup", payload),
    signin: (payload: { email: string; password: string }): Promise<unknown> => ipcRenderer.invoke("auth:signin", payload),
    signout: (): Promise<unknown> => ipcRenderer.invoke("auth:signout"),
    refresh: (): Promise<unknown> => ipcRenderer.invoke("auth:refresh"),
    me: (): Promise<unknown> => ipcRenderer.invoke("auth:me"),
  },
  cloud: {
    getApiBase: (): Promise<string> => ipcRenderer.invoke("cloud:get-api-base"),
    getQuota: (): Promise<unknown> => ipcRenderer.invoke("cloud:quota"),
    syncSessions: (sessions: FocusSession[]): Promise<unknown> => ipcRenderer.invoke("cloud:sync-sessions", sessions),
    syncStats: (stats: { points: number; total_sessions: number; total_mins: number }): Promise<unknown> => ipcRenderer.invoke("cloud:sync-stats", stats),
    getLeaderboard: (limit = 10): Promise<unknown> => ipcRenderer.invoke("cloud:leaderboard", limit),
    onChanged: (cb: Listener<unknown>): (() => void) => onChannel("cloud:changed", cb),
  },
  billing: {
    getPlans: (): Promise<unknown> => ipcRenderer.invoke("billing:plans"),
    getSubscription: (): Promise<unknown> => ipcRenderer.invoke("billing:subscription"),
  },
  shopCloud: {
    getItems: (): Promise<unknown> => ipcRenderer.invoke("shop:items"),
    getInventory: (): Promise<unknown> => ipcRenderer.invoke("shop:inventory"),
    buy: (itemId: string): Promise<unknown> => ipcRenderer.invoke("shop:buy", itemId),
    equip: (itemId: string, action: "equip" | "unequip"): Promise<unknown> => ipcRenderer.invoke("shop:equip", { itemId, action }),
  },
  events: {
    onDistractDetected: (cb: Listener<number>): (() => void) => onChannel("session:distract-detected", cb),
    onTimeline: (cb: Listener<TimelineEntry>): (() => void) => onChannel("session:timeline-entry", cb),
    onSessionChanged: (cb: Listener<ActiveSession | null>): (() => void) => onChannel("session:changed", cb),
    onDetectorStatus: (cb: Listener<string>): (() => void) => onChannel("session:detector-status", cb),
  },
};

contextBridge.exposeInMainWorld("desktopCat", api);

contextBridge.exposeInMainWorld("cat", {
  onCursor: api.cat.onCursor,
  onComeHere: api.cat.onComeHere,
  onResumeWander: api.cat.onResumeWander,
  onEquipItems: api.cat.onEquipItems,
  onShowBubble: api.cat.onShowBubble,
  move: api.cat.move,
  getScreenSize: api.cat.getScreenSize,
  setMouseIgnore: api.cat.setMouseIgnore,
});

export type DesktopCatApi = typeof api;
