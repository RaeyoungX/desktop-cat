import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { activeSubscription, ensureUserBootstrap, quotaForUser, requireAuthAndRateLimit, statsForUser } from "../_shared/desktop/context.ts";
import { fail, ok } from "../_shared/desktop/http.ts";
import { pathAfterFunction, serveJson } from "../_shared/desktop/handler.ts";

serve(serveJson(async (req) => {
  const path = pathAfterFunction(req, "user");
  if (req.method !== "GET" || (path !== "/" && path !== "/me")) return fail("NOT_FOUND", "接口不存在", 404);
  const auth = await requireAuthAndRateLimit(req);
  if (auth instanceof Response) return auth;

  await ensureUserBootstrap(auth.serviceClient, auth.publicUserId);
  const subscription = await activeSubscription(auth.serviceClient, auth.publicUserId);
  const quota = await quotaForUser(auth.serviceClient, auth.publicUserId);
  const stats = await statsForUser(auth.serviceClient, auth.publicUserId);

  return ok({
    user_id: auth.publicUserId,
    email: auth.authUser.email,
    plan: subscription.plan,
    plan_expires_at: subscription.current_period_end,
    quota,
    stats,
  });
}));
