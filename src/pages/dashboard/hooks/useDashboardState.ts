import { useEffect, useMemo, useState } from "react";
import { useInterval } from "../../../hooks/useInterval";
import { buildDailyStats, buildWeekStats, sessionMinutes } from "../../../shared/stats";
import { createTask } from "../../../shared/tasks";
import type { ActiveSession, FocusSession, TimelineEntry, TodayTask } from "../../../shared/types";
import type { DashboardTab } from "../constants";

export function formatTimer(totalSeconds: number): string {
  const seconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(seconds / 60);
  const rem = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
}

function getPoints(sessions: FocusSession[]): number {
  return sessions.reduce((sum, session) => sum + sessionMinutes(session), 0);
}

export function useDashboardState() {
  const [tasks, setTasks] = useState<TodayTask[]>([]);
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [newTaskText, setNewTaskText] = useState("");
  const [focusName, setFocusName] = useState("");
  const [duration, setDuration] = useState(25);
  const [customDuration, setCustomDuration] = useState("");
  const [activeTab, setActiveTab] = useState<DashboardTab>("tasks");
  const [now, setNow] = useState(Date.now());
  const [detectorStatus, setDetectorStatus] = useState("");
  const [equipped, setEquipped] = useState<string[]>([]);

  useEffect(() => {
    void Promise.all([
      window.desktopCat.tasks.list(),
      window.desktopCat.sessions.list(),
      window.desktopCat.sessions.timeline(),
      window.desktopCat.sessions.get(),
      window.desktopCat.cat.getEquipped(),
    ]).then(([loadedTasks, loadedSessions, loadedTimeline, session, loadedEquipped]) => {
      setTasks(loadedTasks);
      setSessions(loadedSessions);
      setTimeline(loadedTimeline);
      setActiveSession(session);
      setEquipped(loadedEquipped);
      if (!session) {
        const first = loadedTasks.find((task) => !task.done);
        if (first) {
          setSelectedTaskId(first.id);
          setFocusName(first.text);
        }
      }
    });

    const cleanups = [
      window.desktopCat.events.onTimeline((entry) => setTimeline((items) => [...items, entry])),
      window.desktopCat.events.onSessionChanged((session) => {
        setActiveSession(session);
        if (!session) void window.desktopCat.sessions.list().then(setSessions);
      }),
      window.desktopCat.events.onDistractDetected(() => {
        void window.desktopCat.sessions.get().then(setActiveSession);
      }),
      window.desktopCat.events.onDetectorStatus(setDetectorStatus),
    ];

    return () => cleanups.forEach((cleanup) => cleanup());
  }, []);

  useInterval(() => setNow(Date.now()), 1000);

  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? null;
  const dailyStats = useMemo(() => buildDailyStats(tasks, sessions), [tasks, sessions]);
  const weekStats = useMemo(() => buildWeekStats(sessions), [sessions]);
  const points = getPoints(sessions);
  const elapsedSeconds = activeSession ? Math.floor((now - activeSession.startTime) / 1000) : 0;
  const totalSeconds = activeSession ? activeSession.duration * 60 : duration * 60;
  const remainingSeconds = Math.max(0, totalSeconds - elapsedSeconds);
  const progress = activeSession ? Math.min(100, (elapsedSeconds / totalSeconds) * 100) : 0;

  async function persistTasks(next: TodayTask[]) {
    setTasks(next);
    await window.desktopCat.tasks.save(next);
  }

  async function addTask() {
    const text = newTaskText.trim();
    if (!text) return;
    const task = createTask(text);
    const next = [...tasks, task];
    setNewTaskText("");
    setSelectedTaskId(task.id);
    setFocusName(task.text);
    await persistTasks(next);
  }

  async function toggleTask(task: TodayTask) {
    const next = tasks.map((item) => item.id === task.id ? { ...item, done: !item.done } : item);
    if (!task.done && selectedTaskId === task.id) {
      setSelectedTaskId(null);
      setFocusName("");
    }
    await persistTasks(next);
  }

  async function removeTask(task: TodayTask) {
    const next = tasks.filter((item) => item.id !== task.id);
    if (selectedTaskId === task.id) {
      setSelectedTaskId(null);
      setFocusName("");
    }
    await persistTasks(next);
  }

  function pickTask(task: TodayTask) {
    if (task.done) return;
    setSelectedTaskId(task.id);
    setFocusName(task.text);
  }

  async function startFocus() {
    const name = focusName.trim();
    if (!name || activeSession) return;
    const nextSession = await window.desktopCat.sessions.start({ name, duration });
    setActiveSession(nextSession);
    setDetectorStatus("");
  }

  async function finishSession() {
    const ended = await window.desktopCat.sessions.end({ completedTaskId: selectedTaskId });
    if (!ended) return;
    const nextSessions = await window.desktopCat.sessions.list();
    setSessions(nextSessions);
    if (selectedTaskId) {
      const nextTasks = tasks.map((task) => task.id === selectedTaskId ? { ...task, done: true } : task);
      await persistTasks(nextTasks);
    }
    setActiveSession(null);
    setSelectedTaskId(null);
    setFocusName("");
    setActiveTab("summary");
  }

  async function toggleEquip(id: string) {
    const next = equipped.includes(id) ? equipped.filter((item) => item !== id) : [...equipped, id];
    setEquipped(await window.desktopCat.cat.equipItems(next));
  }

  useEffect(() => {
    if (activeSession && remainingSeconds <= 0) {
      void finishSession();
    }
  }, [activeSession, remainingSeconds]);

  return {
    activeSession,
    activeTab,
    customDuration,
    dailyStats,
    detectorStatus,
    duration,
    equipped,
    focusName,
    newTaskText,
    points,
    progress,
    remainingSeconds,
    selectedTask,
    selectedTaskId,
    sessions,
    tasks,
    timeline,
    weekStats,
    addTask,
    finishSession,
    pickTask,
    removeTask,
    setActiveTab,
    setCustomDuration,
    setDuration,
    setFocusName,
    setNewTaskText,
    setSelectedTaskId,
    startFocus,
    toggleEquip,
    toggleTask,
  };
}

export type DashboardState = ReturnType<typeof useDashboardState>;
