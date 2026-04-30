import { app, BrowserWindow, globalShortcut, ipcMain, Menu, screen, Tray } from "electron";
import path from "node:path";
import type { ActiveSession, FocusSession, TimelineEntry, TodayTask } from "../../src/shared/types";
import { VisionDetector } from "./detector";
import { cloudClient } from "./cloud-client";
import {
  addSession,
  addTimelineEntry,
  getAuthSession,
  getEquippedItems,
  getSessions,
  getTimeline,
  getTodayTasks,
  getVisionAnalyzeUrl,
  getApiBaseUrl,
  saveTodayTasks,
  setEquippedItems,
} from "./store";
import { defaultVisionAnalyzeUrl } from "./vision-client";
import { createTrayNativeImage } from "./tray-icon";

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);
const rootDir = isDev ? path.join(__dirname, "../..") : path.join(__dirname, "../../..");
const openDevTools = isDev && process.env.DESKTOP_CAT_OPEN_DEVTOOLS !== "false";

let catWindow: BrowserWindow | null = null;
let dashboardWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let currentSession: ActiveSession | null = null;

const CAT_W = 160;
const CAT_H = 210;
const DASHBOARD_W = 500;
const DASHBOARD_H = 720;

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

function toggleDashboardDevTools(): void {
  createDashboard();
  if (!dashboardWindow || dashboardWindow.isDestroyed()) return;
  if (dashboardWindow.webContents.isDevToolsOpened()) {
    dashboardWindow.webContents.closeDevTools();
  } else {
    dashboardWindow.webContents.openDevTools({ mode: "detach" });
  }
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
  catWindow.setIgnoreMouseEvents(false);
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
    width: DASHBOARD_W,
    height: DASHBOARD_H,
    minWidth: 390,
    minHeight: 640,
    x: Math.floor(width / 2 - DASHBOARD_W / 2),
    y: Math.floor(height / 2 - DASHBOARD_H / 2),
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
  if (openDevTools) {
    dashboardWindow.webContents.once("did-finish-load", () => {
      if (dashboardWindow && !dashboardWindow.isDestroyed()) {
        dashboardWindow.webContents.openDevTools({ mode: "detach" });
      }
    });
  }
  if (isDev) {
    dashboardWindow.webContents.on("before-input-event", (event, input) => {
      if (input.key === "F12" && input.type === "keyDown") {
        event.preventDefault();
        if (!dashboardWindow || dashboardWindow.isDestroyed()) return;
        if (dashboardWindow.webContents.isDevToolsOpened()) {
          dashboardWindow.webContents.closeDevTools();
        } else {
          dashboardWindow.webContents.openDevTools({ mode: "detach" });
        }
      }
    });
  }
  dashboardWindow.on("closed", () => {
    dashboardWindow = null;
  });
}

function createTray(): void {
  tray = new Tray(createTrayNativeImage(publicAsset("assets", "cat-loaf.png")));
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
    ...(isDev ? [
      { type: "separator" as const },
      { label: "打开/关闭 Dashboard 控制台", click: () => toggleDashboardDevTools() },
    ] : []),
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
  getEndpoint: () => getVisionAnalyzeUrl() || defaultVisionAnalyzeUrl(),
  onActivity: (entry: TimelineEntry) => {
    addTimelineEntry(entry);
    sendToDashboard("session:timeline-entry", entry);
  },
  onAnalyzed: async (result, sessionId) => {
    if (!getAuthSession()?.access_token) return;
    const reported = await cloudClient.reportQuota({
      session_id: sessionId,
      duration_seconds: 30,
      status: result.status,
      activity: result.activity,
    });
    if (!reported.ok) {
      sendToDashboard("cloud:changed", { quotaError: reported.error?.message ?? "额度上报失败" });
      if (reported.error?.code === "QUOTA_EXCEEDED") {
        sendToDashboard("session:detector-status", reported.error.message);
      }
    }
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
    sendToCat("cat:resume-wander", undefined);
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
    catWindow.setIgnoreMouseEvents(false);
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
  void cloudClient.syncSessions([session]).then((result) => {
    sendToDashboard("cloud:changed", {
      sync: result.ok ? "synced" : "failed",
      message: result.ok ? "云同步完成" : result.error?.message ?? "云同步失败",
    });
  });
  currentSession = null;
  updateTrayMenu();
  sendToDashboard("session:changed", null);
  sendToCat("cat:show-bubble", "今天辛苦了。");
  setTimeout(() => {
    if (!currentSession && catWindow && !catWindow.isDestroyed()) {
      catWindow.setIgnoreMouseEvents(false);
      catWindow.hide();
    }
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

  ipcMain.handle("cloud:get-api-base", () => getApiBaseUrl());
  ipcMain.handle("auth:session", () => cloudClient.getAuthSession());
  ipcMain.handle("auth:signup", (_, payload: { email: string; password: string }) => cloudClient.signup(payload.email, payload.password));
  ipcMain.handle("auth:signin", (_, payload: { email: string; password: string }) => cloudClient.signin(payload.email, payload.password));
  ipcMain.handle("auth:signout", () => cloudClient.signout());
  ipcMain.handle("auth:refresh", () => cloudClient.refresh());
  ipcMain.handle("auth:me", () => cloudClient.me());
  ipcMain.handle("cloud:quota", () => cloudClient.getQuota());
  ipcMain.handle("cloud:sync-sessions", (_, sessions) => cloudClient.syncSessions(sessions));
  ipcMain.handle("cloud:sync-stats", (_, stats) => cloudClient.syncStats(stats));
  ipcMain.handle("cloud:leaderboard", (_, limit: number) => cloudClient.getLeaderboard(limit));
  ipcMain.handle("billing:plans", () => cloudClient.getPlans());
  ipcMain.handle("billing:subscription", () => cloudClient.getSubscription());
  ipcMain.handle("shop:items", () => cloudClient.getShopItems());
  ipcMain.handle("shop:inventory", () => cloudClient.getInventory());
  ipcMain.handle("shop:buy", (_, itemId: string) => cloudClient.buyItem(itemId));
  ipcMain.handle("shop:equip", async (_, payload: { itemId: string; action: "equip" | "unequip" }) => {
    const result = await cloudClient.equipItem(payload.itemId, payload.action);
    if (result.ok && result.data && typeof result.data === "object" && "equipped" in result.data) {
      const equipped = (result.data as { equipped?: unknown }).equipped;
      if (Array.isArray(equipped)) {
        const safe = setEquippedItems(equipped.filter((item) => typeof item === "string"));
        sendToCat("cat:equip-items", safe);
      }
    }
    return result;
  });

  ipcMain.on("cloud:refresh-dashboard", () => {
    sendToDashboard("cloud:changed", { refresh: Date.now() });
  });
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
