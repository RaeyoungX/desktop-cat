import { describe, expect, it } from "vitest";
import { normalizeVisionPayload, visionResponseForLog } from "../../../electron/main/vision-client";

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

  it("formats wrapped analyze responses for safe logging", () => {
    expect(visionResponseForLog({
      ok: true,
      data: {
        status: "focused",
        confidence: 0.73,
        activity: "写代码",
        reason: "Editor is task related.",
        checkId: "check-2",
      },
    })).toEqual({
      ok: true,
      data: {
        status: "focused",
        confidence: 0.73,
        activity: "写代码",
        reason: "Editor is task related.",
        checkId: "check-2",
      },
    });

    expect(visionResponseForLog({
      ok: false,
      error: { code: "QUOTA_EXCEEDED", message: "额度不足" },
    })).toEqual({
      ok: false,
      error: { code: "QUOTA_EXCEEDED", message: "额度不足", data: undefined },
    });
  });
});
