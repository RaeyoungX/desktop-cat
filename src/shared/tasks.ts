import { todayKey } from "./date";
import type { TodayTask } from "./types";

export type TaskBucket = {
  date: string;
  tasks: TodayTask[];
};

export function makeTaskBucket(tasks: TodayTask[], date = new Date()): TaskBucket {
  return {
    date: todayKey(date),
    tasks,
  };
}

export function loadTodayTasksFromBucket(bucket: TaskBucket | null | undefined, date = new Date()): TodayTask[] {
  if (!bucket || bucket.date !== todayKey(date)) return [];
  return Array.isArray(bucket.tasks) ? bucket.tasks : [];
}

export function createTask(text: string, now = Date.now()): TodayTask {
  return {
    id: `task_${now}_${Math.random().toString(36).slice(2, 8)}`,
    text: text.trim(),
    done: false,
    createdAt: now,
  };
}
