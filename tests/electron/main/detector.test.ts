import { describe, expect, it, vi } from "vitest";
import { applyVisionResult, capturePrimaryScreenshot, VisionDetector } from "../../../electron/main/detector";

vi.mock("screenshot-desktop", () => ({
  default: async () => {
    throw new Error("Screen Recording permission denied");
  },
}));

describe("vision distraction state machine", () => {
  it("does not alert on a single distracted result", () => {
    const state = applyVisionResult({ consecutiveDistracted: 0, alerting: false, sessionDistractCount: 0 }, "distracted");

    expect(state).toEqual({
      consecutiveDistracted: 1,
      alerting: false,
      sessionDistractCount: 0,
      event: "none",
    });
  });

  it("alerts after two consecutive distracted results", () => {
    const state = applyVisionResult({ consecutiveDistracted: 1, alerting: false, sessionDistractCount: 0 }, "distracted");

    expect(state).toMatchObject({
      consecutiveDistracted: 2,
      alerting: true,
      sessionDistractCount: 1,
      event: "distracted",
    });
  });

  it("can alert after one distracted result when sensitivity is high", () => {
    const state = applyVisionResult({ consecutiveDistracted: 0, alerting: false, sessionDistractCount: 0 }, "distracted", 1);

    expect(state).toMatchObject({
      consecutiveDistracted: 1,
      alerting: true,
      sessionDistractCount: 1,
      event: "distracted",
    });
  });

  it("waits for three consecutive distracted results when sensitivity is low", () => {
    const waiting = applyVisionResult({ consecutiveDistracted: 1, alerting: false, sessionDistractCount: 0 }, "distracted", 3);
    const alerted = applyVisionResult({ consecutiveDistracted: 2, alerting: false, sessionDistractCount: 0 }, "distracted", 3);

    expect(waiting).toMatchObject({
      consecutiveDistracted: 2,
      alerting: false,
      sessionDistractCount: 0,
      event: "none",
    });
    expect(alerted).toMatchObject({
      consecutiveDistracted: 3,
      alerting: true,
      sessionDistractCount: 1,
      event: "distracted",
    });
  });

  it("resets on focused and uncertain results", () => {
    const focused = applyVisionResult({ consecutiveDistracted: 2, alerting: true, sessionDistractCount: 1 }, "focused");
    const uncertain = applyVisionResult({ consecutiveDistracted: 2, alerting: true, sessionDistractCount: 1 }, "uncertain");

    expect(focused).toMatchObject({ consecutiveDistracted: 0, alerting: false, event: "focused" });
    expect(uncertain).toMatchObject({ consecutiveDistracted: 0, alerting: false, event: "focused" });
  });
});

describe("primary screenshot capture", () => {
  it("uses display 0 first and falls back to default capture when display selection fails", async () => {
    const calls: Array<{ format: "jpg"; screen?: number }> = [];
    const capture = async (options: { format: "jpg"; screen?: number }) => {
      calls.push(options);
      if (options.screen === 0) throw new Error("Invalid choice of displayId: main");
      return Buffer.from("fallback-image");
    };

    const result = await capturePrimaryScreenshot(capture);

    expect(result.toString()).toBe("fallback-image");
    expect(calls).toEqual([{ format: "jpg", screen: 0 }, { format: "jpg" }]);
  });
});

describe("screen permission fallback", () => {
  it("switches to behavior-only mode without triggering a distraction", async () => {
    const statuses: string[] = [];
    const activities: Array<{ status: string; activity: string }> = [];
    const distracted = vi.fn();

    const detector = new VisionDetector({
      getAccessToken: () => "token",
      getEndpoint: () => "https://example.com/vision",
      getIdleSeconds: () => 120,
      onStatus: (message) => statuses.push(message),
      onActivity: (entry) => activities.push({ status: entry.status, activity: entry.activity }),
      onDistracted: distracted,
    } as ConstructorParameters<typeof VisionDetector>[0] & { getIdleSeconds: () => number });

    detector.start("写 React 组件", "sess_local");
    await detector.runCheck();
    detector.stop();

    expect(statuses.join("\n")).toContain("屏幕录制权限未开启");
    expect(activities).toEqual([{ status: "uncertain", activity: "低精度行为" }]);
    expect(distracted).not.toHaveBeenCalled();
  });
});
