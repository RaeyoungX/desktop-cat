import { describe, expect, it } from "vitest";
import { normalizeVisionPayload } from "../../../electron/main/vision-client";

describe("vision response parser", () => {
  it("normalizes unknown statuses to uncertain", () => {
    expect(normalizeVisionPayload({ status: "maybe", confidence: 2, activity: "", reason: 123 })).toEqual({
      status: "uncertain",
      confidence: 1,
      activity: "无法判断",
      reason: "",
      checkId: undefined,
    });
  });

  it("keeps valid focused and distracted results", () => {
    expect(normalizeVisionPayload({
      status: "distracted",
      confidence: 0.82,
      activity: "刷视频",
      reason: "Short video feed is unrelated.",
      checkId: "check-1",
    })).toEqual({
      status: "distracted",
      confidence: 0.82,
      activity: "刷视频",
      reason: "Short video feed is unrelated.",
      checkId: "check-1",
    });
  });
});
