import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.105.0";

export type QuotaDecision = {
  allowed: boolean;
  code?: string;
  message?: string;
  plan?: string;
  planHours?: number;
  usedSeconds?: number;
};

const PLAN_HOURS: Record<string, number> = {
  free: 5,
  light: 20,
  pro: 60,
  power: 120,
};

function monthKey(date = new Date()): string {
  return date.toISOString().slice(0, 7);
}

export async function checkVisionQuota(serviceClient: SupabaseClient, userId: string): Promise<QuotaDecision> {
  const { data: subscription } = await serviceClient
    .from("subscriptions")
    .select("plan,status,period_end")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("period_end", { ascending: false })
    .limit(1)
    .maybeSingle();

  const plan = typeof subscription?.plan === "string" ? subscription.plan : "free";
  const planHours = PLAN_HOURS[plan] ?? PLAN_HOURS.free;
  const { data: usage } = await serviceClient
    .from("quota_usage")
    .select("used_seconds")
    .eq("user_id", userId)
    .eq("month", monthKey())
    .maybeSingle();

  const usedSeconds = Number(usage?.used_seconds ?? 0);
  if (usedSeconds >= planHours * 3600) {
    return {
      allowed: false,
      code: "QUOTA_EXCEEDED",
      message: "本月 AI 检测额度已用完",
      plan,
      planHours,
      usedSeconds,
    };
  }

  return { allowed: true, plan, planHours, usedSeconds };
}

export async function hitRateLimit(
  serviceClient: SupabaseClient,
  bucketKey: string,
  limit: number,
): Promise<boolean> {
  const windowStart = new Date();
  windowStart.setUTCSeconds(0, 0);
  const { data } = await serviceClient
    .from("rate_limit_buckets")
    .select("hit_count")
    .eq("bucket_key", bucketKey)
    .eq("window_start", windowStart.toISOString())
    .maybeSingle();

  const next = Number(data?.hit_count ?? 0) + 1;
  await serviceClient
    .from("rate_limit_buckets")
    .upsert({
      bucket_key: bucketKey,
      window_start: windowStart.toISOString(),
      hit_count: next,
    }, { onConflict: "bucket_key,window_start" });

  return next > limit;
}
