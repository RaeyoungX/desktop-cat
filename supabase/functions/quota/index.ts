import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { activeSubscription, quotaForUser, requireAuthAndRateLimit } from "../_shared/desktop/context.ts";
import { fail, ok, parseJsonBody } from "../_shared/desktop/http.ts";
import { serveJson, pathAfterFunction } from "../_shared/desktop/handler.ts";
import { hitRateLimit } from "../_shared/desktop/rate_limit.ts";
import { monthKey, quotaSnapshot } from "../_shared/desktop/plans.ts";

serve(serveJson(async (req) => {
  const path = pathAfterFunction(req, "quota");
  const auth = await requireAuthAndRateLimit(req);
  if (auth instanceof Response) return auth;

  if (req.method === "GET" && path === "/status") {
    return ok(await quotaForUser(auth.serviceClient, auth.publicUserId));
  }

  if (req.method === "POST" && path === "/report") {
    const rate = await hitRateLimit(auth.serviceClient, `quota:user:${auth.publicUserId}`, 4);
    if (rate.limited) return fail("RATE_LIMITED", "请求过频", 429);

    const body = await parseJsonBody(req);
    const durationSeconds = Math.max(1, Math.min(3600, Math.round(Number(body.duration_seconds ?? 30) || 30)));
    const before = await quotaForUser(auth.serviceClient, auth.publicUserId);
    if (before.remaining_hours <= 0) return fail("QUOTA_EXCEEDED", "本月 AI 检测额度已用完", 402, before);

    const month = monthKey();
    const { data } = await auth.serviceClient
      .from("quota_usage")
      .select("used_seconds")
      .eq("user_id", auth.publicUserId)
      .eq("month", month)
      .maybeSingle();
    const usedSeconds = Number(data?.used_seconds ?? 0) + durationSeconds;
    await auth.serviceClient.from("quota_usage").upsert({
      user_id: auth.publicUserId,
      month,
      used_seconds: usedSeconds,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,month" });

    const subscription = await activeSubscription(auth.serviceClient, auth.publicUserId);
    return ok(quotaSnapshot(subscription.plan, usedSeconds));
  }

  return fail("NOT_FOUND", "接口不存在", 404);
}));
