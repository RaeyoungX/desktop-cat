import { describe, expect, it } from "vitest";
import { applyVisionResult, capturePrimaryScreenshot } from "../../../electron/main/detector";

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
