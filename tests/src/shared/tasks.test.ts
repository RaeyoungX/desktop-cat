import { describe, expect, it } from "vitest";
import { loadTodayTasksFromBucket, makeTaskBucket } from "../../../src/shared/tasks";

describe("task date buckets", () => {
  it("returns tasks for the same local day", () => {
    const date = new Date("2026-04-30T08:00:00+08:00");
    const bucket = makeTaskBucket(
      [{ id: "1", text: "写组件", done: false, createdAt: 1 }],
      date,
    );

    expect(loadTodayTasksFromBucket(bucket, date)).toHaveLength(1);
  });

  it("clears stale tasks from previous days", () => {
    const bucket = makeTaskBucket(
      [{ id: "1", text: "旧任务", done: false, createdAt: 1 }],
      new Date("2026-04-29T23:00:00+08:00"),
    );

    expect(loadTodayTasksFromBucket(bucket, new Date("2026-04-30T08:00:00+08:00"))).toEqual([]);
  });
});
