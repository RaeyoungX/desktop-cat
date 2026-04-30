import Store from "electron-store";
import { todayKey } from "../../src/shared/date";
import type { FocusSession, TimelineEntry, TodayTask } from "../../src/shared/types";
import { loadTodayTasksFromBucket, makeTaskBucket, type TaskBucket } from "../../src/shared/tasks";

type AuthSession = {
  access_token?: string;
  refresh_token?: string;
  expires_at?: number;
  user?: {
    id: string;
    email?: string;
  };
};

type AppStore = {
  tasks?: TaskBucket;
  sessions?: FocusSession[];
  timeline?: Record<string, TimelineEntry[]>;
  equipped?: string[];
  authSession?: AuthSession | null;
  settings?: {
    apiBaseUrl?: string;
    visionAnalyzeUrl?: string;
  };
};

const store = new Store<AppStore>({
  defaults: {
    sessions: [],
    timeline: {},
    equipped: [],
    settings: {},
  },
});

export function getTodayTasks(date = new Date()): TodayTask[] {
  return loadTodayTasksFromBucket(store.get("tasks"), date);
}

export function saveTodayTasks(tasks: TodayTask[], date = new Date()): TodayTask[] {
  store.set("tasks", makeTaskBucket(tasks, date));
  return tasks;
}

export function getSessions(): FocusSession[] {
  return store.get("sessions", []);
}

export function addSession(session: FocusSession): FocusSession[] {
  const sessions = getSessions();
  const next = sessions.some((item) => item.localId === session.localId)
    ? sessions.map((item) => item.localId === session.localId ? session : item)
    : [...sessions, session];
  store.set("sessions", next);
  return next;
}

export function getTimeline(date = new Date()): TimelineEntry[] {
  const all = store.get("timeline", {});
  return all[todayKey(date)] ?? [];
}

export function addTimelineEntry(entry: TimelineEntry, date = new Date()): TimelineEntry[] {
  const all = store.get("timeline", {});
  const key = todayKey(date);
  const next = [...(all[key] ?? []), entry].slice(-100);
  store.set("timeline", { ...all, [key]: next });
  return next;
}

export function getEquippedItems(): string[] {
  return store.get("equipped", []);
}

export function setEquippedItems(items: string[]): string[] {
  const safe = Array.isArray(items) ? items.filter((item) => typeof item === "string") : [];
  store.set("equipped", safe);
  return safe;
}

export function getAuthSession(): AuthSession | null {
  return store.get("authSession", null);
}

export function setAuthSession(session: AuthSession | null): void {
  store.set("authSession", session);
}

export function getVisionAnalyzeUrl(): string {
  return store.get("settings.visionAnalyzeUrl")
    || process.env.DESKTOP_CAT_VISION_URL
    || process.env.VITE_DESKTOP_CAT_VISION_URL
    || "";
}
