import type { VisionResult, FocusStatus } from "../../src/shared/types";
import { getApiBaseUrl } from "./store";

function normalizeStatus(value: unknown): FocusStatus {
  return value === "focused" || value === "distracted" || value === "uncertain"
    ? value
    : "uncertain";
}

function clampConfidence(value: unknown): number {
  const confidence = Number(value);
  if (!Number.isFinite(confidence)) return 0;
  return Math.max(0, Math.min(1, confidence));
}

export function normalizeVisionPayload(payload: unknown): VisionResult {
  const raw = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};

  return {
    status: normalizeStatus(raw.status),
    confidence: clampConfidence(raw.confidence),
    activity: typeof raw.activity === "string" && raw.activity.trim() ? raw.activity.trim() : "无法判断",
    reason: typeof raw.reason === "string" ? raw.reason.trim() : "",
    checkId: typeof raw.checkId === "string" ? raw.checkId : undefined,
  };
}

export type AnalyzeScreenInput = {
  endpoint: string;
  apiEndpoint?: string;
  accessToken?: string;
  screenshotBase64: string;
  mimeType: string;
  taskName: string;
  sessionId: string;
  checkId: string;
};

export async function analyzeScreen(input: AnalyzeScreenInput): Promise<VisionResult> {
  if (!input.endpoint || !input.accessToken) {
    return {
      status: "uncertain",
      confidence: 0,
      activity: "AI 检测未配置",
      reason: "Missing endpoint or access token",
      checkId: input.checkId,
    };
  }

  const response = await fetch(input.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.accessToken}`,
    },
    body: JSON.stringify({
      screenshotBase64: input.screenshotBase64,
      mimeType: input.mimeType,
      taskName: input.taskName,
      sessionId: input.sessionId,
      checkId: input.checkId,
      clientMeta: {
        platform: process.platform,
      },
    }),
  });

  if (!response.ok) {
    return {
      status: "uncertain",
      confidence: 0,
      activity: response.status === 402 || response.status === 403 ? "AI 检测暂停" : "AI 检测失败",
      reason: `Vision endpoint returned ${response.status}`,
      checkId: input.checkId,
    };
  }

  const payload = await response.json();
  if (payload && typeof payload === "object" && "ok" in payload) {
    const wrapped = payload as { ok?: boolean; data?: unknown; error?: { code?: string; message?: string } };
    if (!wrapped.ok) {
      return {
        status: "uncertain",
        confidence: 0,
        activity: wrapped.error?.code === "QUOTA_EXCEEDED" ? "AI 额度不足" : "AI 检测暂停",
        reason: wrapped.error?.message ?? "Vision endpoint returned an error",
        checkId: input.checkId,
      };
    }
    return normalizeVisionPayload(wrapped.data);
  }
  return normalizeVisionPayload(payload);
}

export function defaultVisionAnalyzeUrl(): string {
  return `${getApiBaseUrl()}/vision/analyze`;
}
