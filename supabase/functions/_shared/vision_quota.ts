import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.105.0";
import { hitRateLimit as hitDesktopRateLimit } from "./desktop/rate_limit.ts";

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
    .or(`period_end.is.null,period_end.gte.${new Date().toISOString().slice(0, 10)}`)
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
  return (await hitDesktopRateLimit(serviceClient, bucketKey, limit)).limited;
}
