/**
 * analyze-screen/index.ts
 *
 * Backward-compatible Vision function. New clients should use
 * vision /analyze; both paths share the same handler.
 */

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { requireAuthenticatedAppUser } from "../_shared/supabase_client.ts";
import { fail } from "../_shared/desktop/http.ts";
import { analyzeScreenWithVision, type AnalyzeScreenRequest } from "../_shared/vision_analyze.ts";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();
  try {
    const { publicUserId, serviceClient } = await requireAuthenticatedAppUser(req);
    const body = await req.json() as AnalyzeScreenRequest;
    return await analyzeScreenWithVision(serviceClient, publicUserId, body, requestId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    const status = message === "Unauthorized" ? 401 : 500;
    console.error("[analyze-screen] error", { requestId, message });
    return fail(status === 401 ? "UNAUTHORIZED" : "INTERNAL_ERROR", message, status);
  }
});
