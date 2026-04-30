import { describe, expect, it } from "vitest";
import { buildDailyStats, buildWeekStats, catQualityMessage } from "../../../src/shared/stats";
import type { FocusSession, TodayTask } from "../../../src/shared/types";

describe("stats helpers", () => {
  it("uses actual focused seconds and reminder count for today's summary", () => {
    const tasks: TodayTask[] = [
      { id: "1", text: "写 React 组件", done: true, createdAt: 1 },
      { id: "2", text: "整理文档", done: false, createdAt: 2 },
    ];
    const sessions: FocusSession[] = [
      {
        localId: "a",
        name: "写 React 组件",
        plannedMinutes: 45,
        actualSeconds: 2700,
        startTime: new Date("2026-04-30T08:00:00+08:00").getTime(),
        endTime: new Date("2026-04-30T08:45:00+08:00").getTime(),
        distractCount: 2,
      },
      {
        localId: "b",
        name: "整理文档",
        plannedMinutes: 25,
        actualSeconds: 1200,
        startTime: new Date("2026-04-30T10:00:00+08:00").getTime(),
        endTime: new Date("2026-04-30T10:20:00+08:00").getTime(),
        distractCount: 0,
      },
    ];

    expect(buildDailyStats(tasks, sessions, new Date("2026-04-30T12:00:00+08:00"))).toMatchObject({
      totalMinutes: 65,
      sessionCount: 2,
      completedTasks: 1,
      reminderCount: 2,
    });
  });

  it("gives the highest praise only when total time exceeds 60 minutes with no reminders", () => {
    expect(catQualityMessage(61, 0)).toContain("满分");
    expect(catQualityMessage(61, 3)).toContain("温柔");
    expect(catQualityMessage(0, 0)).toContain("还没开始");
  });

  it("builds Monday-to-Sunday week bars with today marked", () => {
    const sessions: FocusSession[] = [
      {
        localId: "m",
        name: "Monday",
        plannedMinutes: 25,
        actualSeconds: 1500,
        startTime: new Date("2026-04-27T09:00:00+08:00").getTime(),
        distractCount: 0,
      },
      {
        localId: "t",
        name: "Today",
        plannedMinutes: 60,
        actualSeconds: 3600,
        startTime: new Date("2026-04-30T09:00:00+08:00").getTime(),
        distractCount: 1,
      },
    ];

    const week = buildWeekStats(sessions, new Date("2026-04-30T12:00:00+08:00"));

    expect(week.map((d) => d.label)).toEqual(["一", "二", "三", "四", "五", "六", "日"]);
    expect(week[0].minutes).toBe(25);
    expect(week[3]).toMatchObject({ minutes: 60, isToday: true });
  });
});
