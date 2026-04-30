import { addDays, startOfWeekMonday, todayKey } from "./date";
import type { DailyStats, FocusSession, TodayTask, WeekDayStats } from "./types";

const WEEK_LABELS = ["一", "二", "三", "四", "五", "六", "日"];

export function sessionMinutes(session: Pick<FocusSession, "actualSeconds" | "plannedMinutes">): number {
  if (session.actualSeconds > 0) return Math.round(session.actualSeconds / 60);
  return session.plannedMinutes;
}

export function catQualityMessage(totalMinutes: number, reminderCount: number): string {
  if (totalMinutes <= 0) return "今天还没开始哦，一起努力吧。";
  if (reminderCount === 0 && totalMinutes > 60) return "满分表现！本猫今天只负责骄傲。";
  if (reminderCount === 0) return "一路都很稳，继续保持这个节奏。";
  if (reminderCount <= 2) return "有一点点走神，但你很快回来了。";
  if (reminderCount <= 4) return "今天有点分散，本猫温柔地陪你捡回来。";
  return "状态辛苦啦，先照顾好自己，再慢慢回来。";
}

export function buildDailyStats(tasks: TodayTask[], sessions: FocusSession[], date = new Date()): DailyStats {
  const key = todayKey(date);
  const todaysSessions = sessions.filter((session) => todayKey(new Date(session.startTime)) === key);
  const totalMinutes = todaysSessions.reduce((sum, session) => sum + sessionMinutes(session), 0);
  const reminderCount = todaysSessions.reduce((sum, session) => sum + session.distractCount, 0);

  return {
    totalMinutes,
    sessionCount: todaysSessions.length,
    completedTasks: tasks.filter((task) => task.done).length,
    reminderCount,
    message: catQualityMessage(totalMinutes, reminderCount),
  };
}

export function buildWeekStats(sessions: FocusSession[], date = new Date()): WeekDayStats[] {
  const start = startOfWeekMonday(date);
  const today = todayKey(date);

  return WEEK_LABELS.map((label, index) => {
    const day = addDays(start, index);
    const key = todayKey(day);
    const minutes = sessions
      .filter((session) => todayKey(new Date(session.startTime)) === key)
      .reduce((sum, session) => sum + sessionMinutes(session), 0);

    return {
      date: key,
      label,
      minutes,
      isToday: key === today,
    };
  });
}
