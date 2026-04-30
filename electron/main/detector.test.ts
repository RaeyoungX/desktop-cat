import { describe, expect, it } from "vitest";
import { applyVisionResult } from "./detector";

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
