import { nativeImage } from "electron";
import screenshot from "screenshot-desktop";
import type { FocusStatus, TimelineEntry, VisionResult } from "../../src/shared/types";
import { analyzeScreen } from "./vision-client";

export const DETECTION_INTERVAL_MS = 30_000;
export const DEFAULT_DISTRACT_THRESHOLD = 2;
export const VISION_IMAGE_MAX_SIDE = 1280;
export const VISION_IMAGE_JPEG_QUALITY = 70;
export type DistractThreshold = 1 | 2 | 3;

export type DetectorState = {
  consecutiveDistracted: number;
  alerting: boolean;
  sessionDistractCount: number;
};

export type DetectorTransition = DetectorState & {
  event: "none" | "distracted" | "focused";
};

export function normalizeDistractThreshold(value: unknown): DistractThreshold {
  return value === 1 || value === 2 || value === 3 ? value : DEFAULT_DISTRACT_THRESHOLD;
}

export function applyVisionResult(
  state: DetectorState,
  status: FocusStatus,
  threshold: DistractThreshold = DEFAULT_DISTRACT_THRESHOLD,
): DetectorTransition {
  if (status === "distracted") {
    const consecutiveDistracted = state.consecutiveDistracted + 1;
    if (consecutiveDistracted >= threshold && !state.alerting) {
      return {
        consecutiveDistracted,
        alerting: true,
        sessionDistractCount: state.sessionDistractCount + 1,
        event: "distracted",
      };
    }

    return {
      ...state,
      consecutiveDistracted,
      event: "none",
    };
  }

  return {
    consecutiveDistracted: 0,
    alerting: false,
    sessionDistractCount: state.sessionDistractCount,
    event: state.alerting ? "focused" : "none",
  };
}

export type DetectorCallbacks = {
  onActivity?: (entry: TimelineEntry) => void;
  onDistracted?: (count: number, result: VisionResult) => void;
  onFocused?: (result: VisionResult) => void;
  onStatus?: (message: string) => void;
  onAnalyzed?: (result: VisionResult, sessionId: string) => void | Promise<void>;
};

export type DetectorOptions = DetectorCallbacks & {
  getAccessToken: () => string | undefined;
  getEndpoint: () => string | undefined;
  getThreshold?: () => DistractThreshold;
  getIdleSeconds?: () => number;
};

type ScreenshotCapture = (options: { format: "jpg"; screen?: number }) => Promise<Buffer>;

export type PreparedScreenshot = {
  buffer: Buffer;
  originalBytes: number;
  processedBytes: number;
  width: number;
  height: number;
  quality: number;
};

function shouldLogDetector(): boolean {
  return Boolean(process.env.VITE_DEV_SERVER_URL) || process.env.DESKTOP_CAT_LOG_API === "true";
}

function logDetector(message: string, details?: Record<string, unknown>): void {
  if (!shouldLogDetector()) return;
  if (details) {
    console.log(`[desktop-cat][detector] ${message}`, details);
    return;
  }
  console.log(`[desktop-cat][detector] ${message}`);
}

export async function capturePrimaryScreenshot(capture: ScreenshotCapture = screenshot as ScreenshotCapture): Promise<Buffer> {
  try {
    return await capture({ format: "jpg", screen: 0 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("Invalid choice of displayId") || message.includes("valid choice")) {
      return capture({ format: "jpg" });
    }
    throw error;
  }
}

export function prepareScreenshotForVision(
  buffer: Buffer,
  maxSide = VISION_IMAGE_MAX_SIDE,
  quality = VISION_IMAGE_JPEG_QUALITY,
): PreparedScreenshot {
  const image = nativeImage.createFromBuffer(buffer);
  const size = image.getSize();
  const longest = Math.max(size.width, size.height);
  const scale = longest > maxSide ? maxSide / longest : 1;
  const width = Math.max(1, Math.round(size.width * scale));
  const height = Math.max(1, Math.round(size.height * scale));
  const resized = scale < 1
    ? image.resize({ width, height, quality: "best" })
    : image;
  const processed = resized.toJPEG(quality);

  return {
    buffer: processed,
    originalBytes: buffer.byteLength,
    processedBytes: processed.byteLength,
    width,
    height,
    quality,
  };
}

function isScreenPermissionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return (
    message.includes("screen recording")
    || message.includes("permission")
    || message.includes("not authorized")
    || message.includes("access denied")
  );
}

export class VisionDetector {
  private timer: ReturnType<typeof setInterval> | null = null;
  private currentTask = "";
  private sessionId = "";
  private state: DetectorState = {
    consecutiveDistracted: 0,
    alerting: false,
    sessionDistractCount: 0,
  };
  private mode: "vision" | "behaviorOnly" = "vision";

  constructor(private readonly options: DetectorOptions) {}

  start(taskName: string, sessionId: string): void {
    this.stop();
    this.currentTask = taskName;
    this.sessionId = sessionId;
    this.state = {
      consecutiveDistracted: 0,
      alerting: false,
      sessionDistractCount: 0,
    };
    this.mode = "vision";
    logDetector("started", {
      sessionId,
      taskLength: taskName.length,
      firstCheckInMs: DETECTION_INTERVAL_MS,
      endpoint: this.options.getEndpoint() ?? "",
      hasAccessToken: Boolean(this.options.getAccessToken()),
      threshold: this.options.getThreshold?.() ?? DEFAULT_DISTRACT_THRESHOLD,
    });
    this.timer = setInterval(() => void this.runCheck(), DETECTION_INTERVAL_MS);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    if (this.currentTask || this.sessionId) {
      logDetector("stopped", {
        sessionId: this.sessionId,
        distractCount: this.state.sessionDistractCount,
      });
    }
    this.timer = null;
    this.currentTask = "";
    this.sessionId = "";
    this.state.consecutiveDistracted = 0;
    this.state.alerting = false;
    this.mode = "vision";
  }

  getDistractCount(): number {
    return this.state.sessionDistractCount;
  }

  async runCheck(): Promise<void> {
    if (!this.currentTask || !this.sessionId) return;
    if (this.mode === "behaviorOnly") {
      this.runBehaviorCheck();
      return;
    }

    const checkId = `check_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    let imageBuffer: Buffer | null = null;
    let preparedBuffer: Buffer | null = null;
    let screenshotBase64 = "";
    try {
      logDetector("capture start", { checkId, sessionId: this.sessionId });
      imageBuffer = await capturePrimaryScreenshot();
      const prepared = prepareScreenshotForVision(imageBuffer);
      preparedBuffer = prepared.buffer;
      logDetector("capture ok", {
        checkId,
        originalBytes: prepared.originalBytes,
        processedBytes: prepared.processedBytes,
        width: prepared.width,
        height: prepared.height,
        quality: prepared.quality,
      });
      screenshotBase64 = preparedBuffer.toString("base64");
    } catch (error) {
      logDetector("capture failed", {
        checkId,
        message: error instanceof Error ? error.message : "unknown",
      });
      if (isScreenPermissionError(error)) {
        this.mode = "behaviorOnly";
        this.options.onStatus?.("屏幕录制权限未开启，已切换低精度行为检测。");
        this.runBehaviorCheck();
        return;
      }
      this.options.onStatus?.(`截图失败：${error instanceof Error ? error.message : "unknown"}`);
      return;
    } finally {
      imageBuffer = null;
      preparedBuffer = null;
    }

    let result: VisionResult;
    try {
      result = await analyzeScreen({
        endpoint: this.options.getEndpoint() ?? "",
        accessToken: this.options.getAccessToken(),
        screenshotBase64,
        mimeType: "image/jpeg",
        taskName: this.currentTask,
        sessionId: this.sessionId,
        checkId,
      });
    } catch (error) {
      logDetector("analyze failed", {
        checkId,
        message: error instanceof Error ? error.message : "unknown",
      });
      this.options.onStatus?.(`AI 检测失败：${error instanceof Error ? error.message : "unknown"}`);
      return;
    } finally {
      screenshotBase64 = "";
    }
    logDetector("analyze ok", {
      checkId,
      status: result.status,
      confidence: result.confidence,
      activity: result.activity,
    });

    this.options.onActivity?.({
      time: Date.now(),
      status: result.status,
      activity: result.activity,
      reason: result.reason,
    });
    void this.options.onAnalyzed?.(result, this.sessionId);

    const next = applyVisionResult(this.state, result.status, this.options.getThreshold?.() ?? DEFAULT_DISTRACT_THRESHOLD);
    this.state = {
      consecutiveDistracted: next.consecutiveDistracted,
      alerting: next.alerting,
      sessionDistractCount: next.sessionDistractCount,
    };

    if (next.event === "distracted") {
      this.options.onDistracted?.(next.sessionDistractCount, result);
    } else if (next.event === "focused") {
      this.options.onFocused?.(result);
    }
  }

  private runBehaviorCheck(): void {
    const idleSeconds = Math.max(0, Math.round(this.options.getIdleSeconds?.() ?? 0));
    this.state = {
      ...this.state,
      consecutiveDistracted: 0,
      alerting: false,
    };
    this.options.onActivity?.({
      time: Date.now(),
      status: "uncertain",
      activity: "低精度行为",
      reason: idleSeconds >= 90
        ? `Screen permission denied; user idle for ${idleSeconds}s.`
        : "Screen permission denied; behavior-only fallback active.",
    });
  }
}
