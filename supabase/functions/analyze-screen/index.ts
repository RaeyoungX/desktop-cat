/**
 * analyze-screen/index.ts
 *
 * Supabase Edge Function: Analyze current screen relevance via Vertex AI Gemini.
 * Screenshots are used only for this request and are never persisted.
 */

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { getAccessToken, ServiceAccountCredentials } from "../_shared/google_auth.ts";
import { requireAuthenticatedAppUser } from "../_shared/supabase_client.ts";
import { checkVisionQuota, hitRateLimit } from "../_shared/vision_quota.ts";

type VisionStatus = "focused" | "distracted" | "uncertain";

type AnalyzeRequest = {
  screenshotBase64: string;
  mimeType?: string;
  taskName: string;
  sessionId?: string;
  checkId?: string;
  clientMeta?: {
    platform?: string;
  };
};

const credentials: ServiceAccountCredentials = {
  project_id: Deno.env.get("GCP_PROJECT_ID") ?? "",
  private_key: (Deno.env.get("GCP_PRIVATE_KEY") ?? "").replace(/\\n/g, "\n"),
  client_email: Deno.env.get("GCP_CLIENT_EMAIL") ?? "",
};

const VERTEX_LOCATION = Deno.env.get("VERTEX_LOCATION") ?? "global";
const MODEL = Deno.env.get("VISION_MODEL") ?? "gemini-3.1-flash-preview";

function getVertexUrl(): string {
  return `https://${VERTEX_LOCATION}-aiplatform.googleapis.com/v1/projects/${credentials.project_id}/locations/${VERTEX_LOCATION}/publishers/google/models/${MODEL}:generateContent`;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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

function buildPrompt(taskName: string): string {
  return `You are a conservative focus relevance judge for a desktop productivity app.

Current focus task: "${taskName}"

Analyze the screenshot and decide whether the visible screen content is related to the task.

Return "focused" when:
- The screen shows code editors, terminal, docs, writing tools, design tools, task-related websites, email/reference material, notes, meetings, or plausible research for the task.
- The screen is locked, black, blurred, partially hidden, ambiguous, idle, or impossible to judge.
- The user appears to be checking reference material or switching windows briefly.

Return "distracted" only when the content is clearly unrelated entertainment or personal browsing, such as short videos, games, shopping, social feeds, unrelated chat, or obvious leisure content.

Return "uncertain" when you cannot confidently decide. The client treats uncertain as focused.

Be intentionally conservative. False reminders are worse than missed distractions.

Respond ONLY as valid JSON:
{
  "status": "focused" | "distracted" | "uncertain",
  "confidence": number,
  "activity": "short Chinese phrase, <= 12 chars",
  "reason": "brief English reason, no sensitive details"
}`;
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

function normalizeAnalysis(raw: unknown, checkId?: string) {
  const object = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  return {
    status: normalizeStatus(object.status),
    confidence: clampConfidence(object.confidence),
    activity: typeof object.activity === "string" && object.activity.trim() ? object.activity.trim().slice(0, 24) : "无法判断",
    reason: typeof object.reason === "string" ? object.reason.trim().slice(0, 240) : "",
    checkId,
  };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();
  const started = Date.now();

  try {
    const { publicUserId, serviceClient } = await requireAuthenticatedAppUser(req);

    if (await hitRateLimit(serviceClient, `vision:user:${publicUserId}`, 4)) {
      console.warn("[analyze-screen] rate limited", { requestId, user: publicUserId.slice(0, 8) });
      return jsonResponse({ ok: false, error: { code: "RATE_LIMITED", message: "请求过频" } }, 429);
    }

    const quota = await checkVisionQuota(serviceClient, publicUserId);
    if (!quota.allowed) {
      return jsonResponse({ ok: false, error: { code: quota.code, message: quota.message, data: quota } }, 402);
    }

    const body = await req.json() as AnalyzeRequest;
    const taskName = sanitizeTaskName(body.taskName);
    const mimeType = sanitizeMimeType(body.mimeType);
    const checkId = typeof body.checkId === "string" ? body.checkId : requestId;

    if (!body.screenshotBase64 || typeof body.screenshotBase64 !== "string") {
      return jsonResponse({ ok: false, error: { code: "BAD_REQUEST", message: "Missing screenshotBase64" } }, 400);
    }
    if (!taskName) {
      return jsonResponse({ ok: false, error: { code: "BAD_REQUEST", message: "Missing taskName" } }, 400);
    }

    const accessToken = await getAccessToken(credentials, "https://www.googleapis.com/auth/cloud-platform");
    const vertexBody = {
      contents: [{
        role: "user",
        parts: [
          { inlineData: { mimeType, data: body.screenshotBase64 } },
          { text: buildPrompt(taskName) },
        ],
      }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0,
        maxOutputTokens: 512,
        thinkingConfig: {
          thinkingBudget: 0,
        },
      },
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
        body: JSON.stringify(vertexBody),
      });
      if (vertexRes.ok) break;
      lastErrText = await vertexRes.text();
      console.error("[analyze-screen] Vertex error", {
        requestId,
        status: vertexRes.status,
        attempt: attempt + 1,
      });
      if ([400, 401, 403].includes(vertexRes.status)) break;
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    }

    if (!vertexRes || !vertexRes.ok) {
      return jsonResponse({ ok: false, error: { code: "VISION_FAILED", message: "Vision analysis failed", detail: lastErrText.slice(0, 300) } }, 502);
    }

    const textContent = parseVertexText(await vertexRes.json());
    let parsed: unknown = {};
    try {
      parsed = JSON.parse(textContent || "{}");
    } catch {
      const match = textContent.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : {};
    }

    const result = normalizeAnalysis(parsed, checkId);
    console.log("[analyze-screen] complete", {
      requestId,
      user: publicUserId.slice(0, 8),
      model: MODEL,
      status: result.status,
      elapsedMs: Date.now() - started,
      platform: body.clientMeta?.platform ?? "unknown",
    });

    return jsonResponse(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    const status = message === "Unauthorized" ? 401 : 500;
    console.error("[analyze-screen] error", { requestId, message });
    return jsonResponse({ ok: false, error: { code: status === 401 ? "UNAUTHORIZED" : "INTERNAL_ERROR", message } }, status);
  }
});
