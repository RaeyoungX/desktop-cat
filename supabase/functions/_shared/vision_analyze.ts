import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.105.0";
import { getAccessToken, ServiceAccountCredentials } from "./google_auth.ts";
import { checkVisionQuota } from "./vision_quota.ts";
import { fail, jsonResponse, ok } from "./desktop/http.ts";
import { hitRateLimit } from "./desktop/rate_limit.ts";

export type VisionStatus = "focused" | "distracted" | "uncertain";

export type AnalyzeScreenRequest = {
  screenshotBase64: string;
  mimeType?: string;
  taskName: string;
  sessionId?: string;
  checkId?: string;
  clientMeta?: {
    platform?: string;
  };
};

export type VisionAnalysis = {
  status: VisionStatus;
  confidence: number;
  activity: string;
  reason: string;
  checkId?: string;
};

const credentials: ServiceAccountCredentials = {
  project_id: Deno.env.get("GCP_PROJECT_ID") ?? "",
  private_key: (Deno.env.get("GCP_PRIVATE_KEY") ?? "").replace(/\\n/g, "\n"),
  client_email: Deno.env.get("GCP_CLIENT_EMAIL") ?? "",
};

const VERTEX_LOCATION = Deno.env.get("VERTEX_LOCATION") ?? Deno.env.get("VERTEX_REGION") ?? "us-central1";
const DEFAULT_VISION_MODEL = "gemini-3.1-flash-lite-preview";
const MODEL = Deno.env.get("VISION_MODEL")?.trim() || DEFAULT_VISION_MODEL;

function getVertexUrl(): string {
  return `https://${VERTEX_LOCATION}-aiplatform.googleapis.com/v1/projects/${credentials.project_id}/locations/${VERTEX_LOCATION}/publishers/google/models/${MODEL}:generateContent`;
}

function isGemini3Model(model: string): boolean {
  return model.startsWith("gemini-3");
}

function generationConfigForModel(model: string): Record<string, unknown> {
  return {
    responseMimeType: "application/json",
    temperature: 0,
    maxOutputTokens: 512,
    thinkingConfig: isGemini3Model(model)
      ? { thinkingLevel: "MINIMAL" }
      : { thinkingBudget: 0 },
  };
}

function sanitizeTaskName(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, 120);
}

function sanitizeMimeType(value: unknown): string {
  const mimeType = typeof value === "string" ? value.split(";")[0].trim().toLowerCase() : "image/jpeg";
  if (["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(mimeType)) {
    return mimeType === "image/jpg" ? "image/jpeg" : mimeType;
  }
  return "image/jpeg";
}

function normalizeStatus(value: unknown): VisionStatus {
  return value === "focused" || value === "distracted" || value === "uncertain" ? value : "uncertain";
}

function clampConfidence(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(number, 1)) : 0;
}

async function shortHash(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .slice(0, 6)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

const VISION_SYSTEM_PROMPT = `You are a focus relevance judge for a desktop productivity app.

Analyze the screenshot and decide whether the visible screen content is meaningfully related to the current task.

Return "focused" when:
- There is clear visual evidence that the current screen supports the task: code/editor/terminal for development tasks, docs/specs/reference pages for the same topic, design tools/assets for design tasks, writing documents for writing tasks, or task-specific research.
- Email, chat, meetings, search results, and browser pages are focused ONLY if their visible content is clearly connected to the task name.
- Reference material is focused ONLY when visible text, formulas, UI labels, filenames, URLs, or page content show a direct task connection. Generic browsing is not reference material.

Return "distracted" when:
- The screen is clearly unrelated to the task and shows entertainment, short videos, games, shopping, social feeds, unrelated chat, memes, news feeds, personal browsing, or leisure content.
- The visible app/page is work-like but unrelated to the current task, such as an unrelated email/chat thread, unrelated documentation, unrelated dashboard, or unrelated website.
- The task is specific but the screen shows a generic home page, feed, inbox, or search page with no visible task connection.

Return "uncertain" only when:
- The screenshot is locked, black, blurred, hidden, too cropped, loading, empty, or impossible to judge.
- The screen is partially visible and there is not enough information to identify the app/page content at all.
- The user appears to be briefly switching windows and no unrelated content is clearly visible.

Decision policy:
- Do not mark content focused just because it is a work app. Require task relevance.
- Do not infer hidden intent. Do not reason that the user "could", "might", or "may" be doing research unless the screenshot visibly supports it.
- If the only focused evidence is speculative, choose distracted, not focused.
- When unrelated or generic content is visible, choose distracted even if the user might theoretically use it for work.
- When visual evidence is genuinely unreadable or absent, choose uncertain. The client treats uncertain as focused.

Respond ONLY as valid JSON:
{
  "status": "focused" | "distracted" | "uncertain",
  "confidence": number,
  "activity": "short Chinese phrase, <= 12 chars",
  "reason": "brief English reason, no sensitive details"
}`;

function buildUserPrompt(taskName: string): string {
  return `Current focus task: "${taskName}"

Analyze the screenshot using the system rules.`;
}

function parseVertexText(vertexData: unknown): string {
  const parts = (vertexData as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> } }>;
  })?.candidates?.[0]?.content?.parts ?? [];
  return parts
    .filter((part) => !part.thought)
    .map((part) => part.text ?? "")
    .join("")
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .replace(/^\uFEFF/, "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim();
}

export function normalizeVisionAnalysis(raw: unknown, checkId?: string): VisionAnalysis {
  const object = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  return {
    status: normalizeStatus(object.status),
    confidence: clampConfidence(object.confidence),
    activity: typeof object.activity === "string" && object.activity.trim() ? object.activity.trim().slice(0, 24) : "无法判断",
    reason: typeof object.reason === "string" ? object.reason.trim().slice(0, 240) : "",
    checkId,
  };
}

export async function analyzeScreenWithVision(
  serviceClient: SupabaseClient,
  publicUserId: string,
  body: AnalyzeScreenRequest,
  requestId = crypto.randomUUID(),
  options: { envelope?: boolean } = {},
): Promise<Response> {
  const started = Date.now();

  const rateLimit = await hitRateLimit(serviceClient, `vision:user:${publicUserId}`, 4);
  if (rateLimit.limited) {
    console.warn("[vision] rate limited", { requestId, user: publicUserId.slice(0, 8) });
    return fail("RATE_LIMITED", "请求过频", 429);
  }

  const quota = await checkVisionQuota(serviceClient, publicUserId);
  if (!quota.allowed) {
    return fail(quota.code, quota.message, 402, quota);
  }

  const taskName = sanitizeTaskName(body.taskName);
  const mimeType = sanitizeMimeType(body.mimeType);
  const checkId = typeof body.checkId === "string" ? body.checkId : requestId;

  if (!body.screenshotBase64 || typeof body.screenshotBase64 !== "string") {
    return fail("BAD_REQUEST", "Missing screenshotBase64", 400);
  }
  if (!taskName) {
    return fail("BAD_REQUEST", "Missing taskName", 400);
  }

  const taskHash = await shortHash(taskName);
  console.log("[vision] request", {
    requestId,
    user: publicUserId.slice(0, 8),
    checkId,
    taskLength: taskName.length,
    taskHash,
    platform: body.clientMeta?.platform ?? "unknown",
  });

  const accessToken = await getAccessToken(credentials, "https://www.googleapis.com/auth/cloud-platform");
  const vertexContents = {
    systemInstruction: {
      parts: [{ text: VISION_SYSTEM_PROMPT }],
    },
    contents: [{
      role: "user",
      parts: [
        { inlineData: { mimeType, data: body.screenshotBase64 } },
        { text: buildUserPrompt(taskName) },
      ],
    }],
  };

  let vertexRes: Response | null = null;
  let lastErrText = "";
  for (let attempt = 0; attempt < 3; attempt += 1) {
    vertexRes = await fetch(getVertexUrl(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...vertexContents,
        generationConfig: generationConfigForModel(MODEL),
      }),
    });
    if (vertexRes.ok) break;
    lastErrText = await vertexRes.text();
    console.error("[vision] Vertex error", {
      requestId,
      model: MODEL,
      location: VERTEX_LOCATION,
      status: vertexRes.status,
      attempt: attempt + 1,
      detail: lastErrText.slice(0, 1000),
    });
    if ([400, 401, 403].includes(vertexRes.status)) break;
    if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
  }

  if (!vertexRes || !vertexRes.ok) {
    return fail("VISION_FAILED", "Vision analysis failed", 502, {
      model: MODEL,
      location: VERTEX_LOCATION,
      detail: lastErrText.slice(0, 1000),
    });
  }

  const textContent = parseVertexText(await vertexRes.json());
  let parsed: unknown = {};
  try {
    parsed = JSON.parse(textContent || "{}");
  } catch {
    const match = textContent.match(/\{[\s\S]*\}/);
    try {
      parsed = match ? JSON.parse(match[0]) : {};
    } catch {
      return fail("VISION_PARSE_FAILED", "Invalid Vision JSON response", 502);
    }
  }

  const result = normalizeVisionAnalysis(parsed, checkId);
  console.log("[vision] complete", {
    requestId,
    user: publicUserId.slice(0, 8),
    model: MODEL,
    status: result.status,
    elapsedMs: Date.now() - started,
    platform: body.clientMeta?.platform ?? "unknown",
  });

  return options.envelope ? ok(result) : jsonResponse(result);
}
