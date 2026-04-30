import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { activeSubscription, requireAuthAndRateLimit } from "../_shared/desktop/context.ts";
import { fail, ok } from "../_shared/desktop/http.ts";
import { serveJson, pathAfterFunction } from "../_shared/desktop/handler.ts";
import { PLANS } from "../_shared/desktop/plans.ts";

serve(serveJson(async (req) => {
  const path = pathAfterFunction(req, "billing");
  if (req.method === "GET" && path === "/plans") return ok({ plans: PLANS });

  if (req.method === "GET" && path === "/subscription") {
    const auth = await requireAuthAndRateLimit(req);
    if (auth instanceof Response) return auth;
    return ok(await activeSubscription(auth.serviceClient, auth.publicUserId));
  }

  return fail("NOT_FOUND", "接口不存在", 404);
}));
