import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.105.0";

export type RateLimitDecision = {
  limited: boolean;
  hitCount: number;
  windowStart: string;
};

export function currentMinuteWindow(date = new Date()): string {
  const windowStart = new Date(date);
  windowStart.setUTCSeconds(0, 0);
  return windowStart.toISOString();
}

export async function hitRateLimit(
  serviceClient: SupabaseClient,
  bucketKey: string,
  limit: number,
): Promise<RateLimitDecision> {
  const windowStart = currentMinuteWindow();
  const { data } = await serviceClient
    .from("rate_limit_buckets")
    .select("hit_count")
    .eq("bucket_key", bucketKey)
    .eq("window_start", windowStart)
    .maybeSingle();

  const hitCount = Number(data?.hit_count ?? 0) + 1;
  await serviceClient
    .from("rate_limit_buckets")
    .upsert({
      bucket_key: bucketKey,
      window_start: windowStart,
      hit_count: hitCount,
    }, { onConflict: "bucket_key,window_start" });

  return {
    limited: hitCount > limit,
    hitCount,
    windowStart,
  };
}
