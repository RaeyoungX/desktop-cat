import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { requireAuthAndRateLimit } from "../_shared/desktop/context.ts";
import { fail, parseJsonBody } from "../_shared/desktop/http.ts";
import { serveJson, pathAfterFunction } from "../_shared/desktop/handler.ts";
import { analyzeScreenWithVision, type AnalyzeScreenRequest } from "../_shared/vision_analyze.ts";

serve(serveJson(async (req) => {
  const path = pathAfterFunction(req, "vision");
  if (req.method !== "POST" || path !== "/analyze") return fail("NOT_FOUND", "接口不存在", 404);

  const auth = await requireAuthAndRateLimit(req);
  if (auth instanceof Response) return auth;
  const body = await parseJsonBody<AnalyzeScreenRequest>(req);
  return analyzeScreenWithVision(auth.serviceClient, auth.publicUserId, body, crypto.randomUUID(), { envelope: true });
}));
