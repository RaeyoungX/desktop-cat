import { app, BrowserWindow, globalShortcut, ipcMain, Menu, screen, Tray } from "electron";
import path from "node:path";
import type { ActiveSession, FocusSession, TimelineEntry, TodayTask } from "../../src/shared/types";
import { VisionDetector } from "./detector";
import {
  addSession,
  addTimelineEntry,
  getAuthSession,
  getEquippedItems,
  getSessions,
  getTimeline,
  getTodayTasks,
  getVisionAnalyzeUrl,
  saveTodayTasks,
  setEquippedItems,
} from "./store";

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);
const rootDir = isDev ? path.join(__dirname, "../..") : path.join(__dirname, "../../..");

let catWindow: BrowserWindow | null = null;
let dashboardWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let currentSession: ActiveSession | null = null;

const CAT_W = 160;
const CAT_H = 210;

function publicAsset(...parts: string[]): string {
  return isDev
    ? path.join(rootDir, "public", ...parts)
    : path.join(process.resourcesPath, "public", ...parts);
}

function rendererUrl(hash = ""): string {
  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    return `${process.env.VITE_DEV_SERVER_URL}${hash}`;
  }
  return `file://${path.join(rootDir, "dist/index.html")}${hash}`;
}

function preloadPath(): string {
  return path.join(__dirname, "../preload/index.js");
}

function sendToDashboard<T>(channel: string, payload: T): void {
  if (dashboardWindow && !dashboardWindow.isDestroyed()) {
    dashboardWindow.webContents.send(channel, payload);
  }
}

function sendToCat<T>(channel: string, payload: T): void {
  if (catWindow && !catWindow.isDestroyed()) {
    catWindow.webContents.send(channel, payload);
  }
}

function elapsedSessionMinutes(): number {
  if (!currentSession) return 0;
  return Math.floor((Date.now() - currentSession.startTime) / 60_000);
}

function createCatWindow(): void {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  catWindow = new BrowserWindow({
    width: CAT_W,
    height: CAT_H,
    x: Math.floor(width / 2 - CAT_W / 2),
    y: height - CAT_H,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  void catWindow.loadURL(rendererUrl("#/cat"));
  catWindow.setIgnoreMouseEvents(true, { forward: true });
  catWindow.hide();

  if (process.platform === "darwin") {
    catWindow.setAlwaysOnTop(true, "screen-saver");
    catWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  }

  setInterval(() => {
    sendToCat("cat:cursor", screen.getCursorScreenPoint());
  }, 33);
}

function createDashboard(): void {
  if (dashboardWindow && !dashboardWindow.isDestroyed()) {
    dashboardWindow.focus();
    return;
  }

  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  dashboardWindow = new BrowserWindow({
    width: 460,
    height: 620,
    minWidth: 390,
    minHeight: 540,
    x: Math.floor(width / 2 - 230),
    y: Math.floor(height / 2 - 310),
    resizable: true,
    frame: false,
    titleBarStyle: "hidden",
    trafficLightPosition: { x: 14, y: 14 },
    backgroundColor: "#FFE14A",
    alwaysOnTop: true,
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  void dashboardWindow.loadURL(rendererUrl());
  dashboardWindow.on("closed", () => {
    dashboardWindow = null;
  });
}

function createTray(): void {
  tray = new Tray(publicAsset("assets", "cat-loaf.png"));
  tray.setToolTip("Desktop Cat");
  updateTrayMenu();
  setInterval(updateTrayMenu, 30_000);
}

function updateTrayMenu(): void {
  if (!tray) return;
  const sessionItem = currentSession
    ? { label: `当前：${currentSession.name} · ${elapsedSessionMinutes()} 分钟`, enabled: false }
    : { label: "暂无进行中的任务", enabled: false };

  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Desktop Cat", enabled: false },
    { type: "separator" },
    sessionItem,
    { label: currentSession ? "查看专注" : "打开 Dashboard", click: () => createDashboard() },
    ...(currentSession ? [{ label: "结束当前专注", click: () => void endSession() }] : []),
    { type: "separator" },
    { label: "退出", click: () => app.quit() },
  ]));
}

function distractMsg(count: number): string {
  if (count <= 2) return ["喂，别走神啦。", "回来，任务在等你。"][count - 1] ?? "回来专注一下。";
  if (count <= 4) return `第 ${count} 次提醒了，慢慢把注意力捡回来。`;
  return "今天可能有点累，本猫陪你缓一缓。";
}

const detector = new VisionDetector({
  getAccessToken: () => getAuthSession()?.access_token,
  getEndpoint: () => getVisionAnalyzeUrl(),
  onActivity: (entry: TimelineEntry) => {
    addTimelineEntry(entry);
    sendToDashboard("session:timeline-entry", entry);
  },
  onDistracted: (count) => {
    const cursor = screen.getCursorScreenPoint();
    sendToCat("cat:come-here", cursor);
    sendToCat("cat:show-bubble", distractMsg(count));
    sendToDashboard("session:distract-detected", count);
    if (currentSession) {
      currentSession = { ...currentSession, distractCount: count };
      sendToDashboard("session:changed", currentSession);
      updateTrayMenu();
    }
  },
  onFocused: () => {
    sendToCat("cat:show-bubble", "很好，继续。");
  },
  onStatus: (message) => {
    sendToDashboard("session:detector-status", message);
  },
});

function startSession(task: { name: string; duration: number }): ActiveSession {
  const duration = Math.max(1, Math.min(480, Math.round(Number(task.duration) || 25)));
  currentSession = {
    localId: `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: String(task.name || "专注任务").trim(),
    duration,
    startTime: Date.now(),
    distractCount: 0,
  };

  updateTrayMenu();
  sendToDashboard("session:changed", currentSession);
  if (catWindow && !catWindow.isDestroyed()) {
    catWindow.show();
    setTimeout(() => sendToCat("cat:show-bubble", "我看着你呢，加油。"), 800);
  }
  detector.start(currentSession.name, currentSession.localId);
  return currentSession;
}

async function endSession(): Promise<FocusSession | null> {
  if (!currentSession) return null;
  detector.stop();

  const endedAt = Date.now();
  const session: FocusSession = {
    localId: currentSession.localId,
    name: currentSession.name,
    plannedMinutes: currentSession.duration,
    actualSeconds: Math.max(1, Math.floor((endedAt - currentSession.startTime) / 1000)),
    startTime: currentSession.startTime,
    endTime: endedAt,
    distractCount: currentSession.distractCount,
  };

  addSession(session);
  currentSession = null;
  updateTrayMenu();
  sendToDashboard("session:changed", null);
  sendToCat("cat:show-bubble", "今天辛苦了。");
  setTimeout(() => {
    if (!currentSession && catWindow && !catWindow.isDestroyed()) catWindow.hide();
  }, 2500);
  return session;
}

function registerIpc(): void {
  ipcMain.on("cat:move", (_, pos: { x?: number; y?: number }) => {
    if (!catWindow || catWindow.isDestroyed()) return;
    const x = Number.isFinite(pos.x) ? Math.round(Number(pos.x)) : 0;
    const y = Number.isFinite(pos.y) ? Math.round(Number(pos.y)) : 0;
    catWindow.setPosition(x, y);
  });

  ipcMain.handle("screen:size", () => {
    const displays = screen.getAllDisplays();
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const display of displays) {
      const { x, y, width, height } = display.workArea;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + width);
      maxY = Math.max(maxY, y + height);
    }
    return { width: maxX - minX, height: maxY - minY, originX: minX, originY: minY };
  });

  ipcMain.handle("tasks:list", () => getTodayTasks());
  ipcMain.handle("tasks:save", (_, tasks: TodayTask[]) => saveTodayTasks(tasks));
  ipcMain.handle("sessions:list", () => getSessions());
  ipcMain.handle("timeline:list", () => getTimeline());
  ipcMain.handle("session:start", (_, task: { name: string; duration: number }) => startSession(task));
  ipcMain.handle("session:end", async () => endSession());
  ipcMain.handle("session:get", () => currentSession);

  ipcMain.handle("cat:equip-items", (_, items: string[]) => {
    const safe = setEquippedItems(items);
    sendToCat("cat:equip-items", safe);
    return safe;
  });
  ipcMain.handle("cat:get-equipped", () => getEquippedItems());
  ipcMain.on("cat:set-mouse-ignore", (_, value: boolean) => {
    if (catWindow && !catWindow.isDestroyed()) {
      catWindow.setIgnoreMouseEvents(Boolean(value), { forward: true });
    }
  });

  ipcMain.on("app:close-dashboard", () => dashboardWindow?.close());
  ipcMain.on("app:open-dashboard", () => createDashboard());
  ipcMain.on("app:quit", () => app.quit());
}

app.whenReady().then(() => {
  registerIpc();
  createCatWindow();
  createTray();
  createDashboard();

  globalShortcut.register("CommandOrControl+Shift+K", () => {
    sendToCat("cat:come-here", screen.getCursorScreenPoint());
  });
});

app.on("activate", () => createDashboard());
app.on("will-quit", () => globalShortcut.unregisterAll());
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
