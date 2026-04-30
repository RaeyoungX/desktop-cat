import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { activeSubscription, requireAuthAndRateLimit } from "../_shared/desktop/context.ts";
import { fail, ok } from "../_shared/desktop/http.ts";
import { serveJson } from "../_shared/desktop/handler.ts";

serve(serveJson(async (req) => {
  if (req.method !== "GET") return fail("NOT_FOUND", "接口不存在", 404);
  const auth = await requireAuthAndRateLimit(req);
  if (auth instanceof Response) return auth;
  return ok(await activeSubscription(auth.serviceClient, auth.publicUserId));
}));
