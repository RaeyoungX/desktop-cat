import type { VisionResult, FocusStatus } from "../../src/shared/types";
import { getApiBaseUrl } from "./store";

function shouldLogVision(): boolean {
  return Boolean(process.env.VITE_DEV_SERVER_URL) || process.env.DESKTOP_CAT_LOG_API === "true";
}

function logVision(message: string, details?: Record<string, unknown>): void {
  if (!shouldLogVision()) return;
  if (details) {
    console.log(`[desktop-cat][vision] ${message} ${JSON.stringify(details, null, 2)}`);
    return;
  }
  console.log(`[desktop-cat][vision] ${message}`);
}

function parseJsonOrText(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text.slice(0, 300);
  }
}

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

export function visionResponseForLog(payload: unknown): unknown {
  if (payload && typeof payload === "object" && "ok" in payload) {
    const wrapped = payload as { ok?: boolean; data?: unknown; error?: { code?: string; message?: string; data?: unknown } };
    if (wrapped.ok) {
      return {
        ok: true,
        data: normalizeVisionPayload(wrapped.data),
      };
    }
    return {
      ok: false,
      error: {
        code: wrapped.error?.code,
        message: wrapped.error?.message,
        data: wrapped.error?.data,
      },
    };
  }
  if (payload && typeof payload === "object") return normalizeVisionPayload(payload);
  return payload;
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
    logVision("xx skip analyze", {
      checkId: input.checkId,
      hasEndpoint: Boolean(input.endpoint),
      hasAccessToken: Boolean(input.accessToken),
    });
    return {
      status: "uncertain",
      confidence: 0,
      activity: "AI 检测未配置",
      reason: "Missing endpoint or access token",
      checkId: input.checkId,
    };
  }

  const startedAt = Date.now();
  logVision("-> POST /vision/analyze", {
    checkId: input.checkId,
    endpoint: input.endpoint,
    taskLength: input.taskName.length,
    imageBytesApprox: Math.round((input.screenshotBase64.length * 3) / 4),
  });

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

  const responseText = await response.text();
  const payload = parseJsonOrText(responseText);

  if (!response.ok) {
    logVision("<- POST /vision/analyze", {
      checkId: input.checkId,
      status: response.status,
      ok: false,
      response: visionResponseForLog(payload),
      elapsedMs: Date.now() - startedAt,
    });
    return {
      status: "uncertain",
      confidence: 0,
      activity: response.status === 402 || response.status === 403 ? "AI 检测暂停" : "AI 检测失败",
      reason: `Vision endpoint returned ${response.status}`,
      checkId: input.checkId,
    };
  }

  if (payload && typeof payload === "object" && "ok" in payload) {
    const wrapped = payload as { ok?: boolean; data?: unknown; error?: { code?: string; message?: string } };
    if (!wrapped.ok) {
      logVision("<- POST /vision/analyze", {
        checkId: input.checkId,
        status: response.status,
        ok: false,
        code: wrapped.error?.code,
        response: visionResponseForLog(payload),
        elapsedMs: Date.now() - startedAt,
      });
      return {
        status: "uncertain",
        confidence: 0,
        activity: wrapped.error?.code === "QUOTA_EXCEEDED" ? "AI 额度不足" : "AI 检测暂停",
        reason: wrapped.error?.message ?? "Vision endpoint returned an error",
        checkId: input.checkId,
      };
    }
    const result = normalizeVisionPayload(wrapped.data);
    logVision("<- POST /vision/analyze", {
      checkId: input.checkId,
      status: response.status,
      ok: true,
      result: result.status,
      confidence: result.confidence,
      response: visionResponseForLog(payload),
      elapsedMs: Date.now() - startedAt,
    });
    return result;
  }
  const result = normalizeVisionPayload(payload);
  logVision("<- POST /vision/analyze", {
    checkId: input.checkId,
    status: response.status,
    ok: true,
    result: result.status,
    confidence: result.confidence,
    response: visionResponseForLog(payload),
    elapsedMs: Date.now() - startedAt,
  });
  return result;
}

export function defaultVisionAnalyzeUrl(): string {
  return `${getApiBaseUrl()}/vision/analyze`;
}
