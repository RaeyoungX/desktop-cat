import screenshot from "screenshot-desktop";
import type { FocusStatus, TimelineEntry, VisionResult } from "../../src/shared/types";
import { analyzeScreen } from "./vision-client";

export const DETECTION_INTERVAL_MS = 30_000;
export const DISTRACT_THRESHOLD = 2;

export type DetectorState = {
  consecutiveDistracted: number;
  alerting: boolean;
  sessionDistractCount: number;
};

export type DetectorTransition = DetectorState & {
  event: "none" | "distracted" | "focused";
};

export function applyVisionResult(state: DetectorState, status: FocusStatus): DetectorTransition {
  if (status === "distracted") {
    const consecutiveDistracted = state.consecutiveDistracted + 1;
    if (consecutiveDistracted >= DISTRACT_THRESHOLD && !state.alerting) {
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
};

type ScreenshotCapture = (options: { format: "jpg"; screen?: number }) => Promise<Buffer>;

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

export class VisionDetector {
  private timer: ReturnType<typeof setInterval> | null = null;
  private currentTask = "";
  private sessionId = "";
  private state: DetectorState = {
    consecutiveDistracted: 0,
    alerting: false,
    sessionDistractCount: 0,
  };

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
    this.timer = setInterval(() => void this.runCheck(), DETECTION_INTERVAL_MS);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.currentTask = "";
    this.sessionId = "";
    this.state.consecutiveDistracted = 0;
    this.state.alerting = false;
  }

  getDistractCount(): number {
    return this.state.sessionDistractCount;
  }

  async runCheck(): Promise<void> {
    if (!this.currentTask || !this.sessionId) return;

    let imageBuffer: Buffer | null = null;
    let screenshotBase64 = "";
    try {
      imageBuffer = await capturePrimaryScreenshot();
      screenshotBase64 = imageBuffer.toString("base64");
    } catch (error) {
      this.options.onStatus?.(`截图失败：${error instanceof Error ? error.message : "unknown"}`);
      return;
    } finally {
      imageBuffer = null;
    }

    const checkId = `check_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
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
      this.options.onStatus?.(`AI 检测失败：${error instanceof Error ? error.message : "unknown"}`);
      return;
    } finally {
      screenshotBase64 = "";
    }

    this.options.onActivity?.({
      time: Date.now(),
      status: result.status,
      activity: result.activity,
      reason: result.reason,
    });
    void this.options.onAnalyzed?.(result, this.sessionId);

    const next = applyVisionResult(this.state, result.status);
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
}
