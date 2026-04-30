import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.105.0";
import { requireAuthenticatedAppUser } from "../supabase_client.ts";
import { hitRateLimit } from "./rate_limit.ts";
import { fail } from "./http.ts";
import {
  DEFAULT_OWNED_ITEMS,
  isBillingCycle,
  isPlanId,
  levelForStats,
  monthKey,
  quotaSnapshot,
  todayDateString,
  type BillingCycle,
  type PlanId,
} from "./plans.ts";

export type AuthContext = Awaited<ReturnType<typeof requireAuthenticatedAppUser>>;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

export function serviceClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

export function anonClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
}

export function trimText(value: unknown, max = 240): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function isoFromInput(value: unknown, fallback = Date.now()): string {
  if (typeof value === "number" && Number.isFinite(value)) return new Date(value).toISOString();
  if (typeof value === "string" && value.trim()) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  }
  return new Date(fallback).toISOString();
}

export function orderId(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase();
  return `CAT${date}${suffix}`;
}

export async function requireAuthAndRateLimit(req: Request, limit = 60): Promise<AuthContext | Response> {
  const ctx = await requireAuthenticatedAppUser(req);
  const decision = await hitRateLimit(ctx.serviceClient, `api:user:${ctx.publicUserId}`, limit);
  if (decision.limited) return fail("RATE_LIMITED", "请求过频", 429);
  return ctx;
}

export async function ensureUserBootstrap(client: SupabaseClient, userId: string): Promise<void> {
  await client.from("user_stats").upsert({
    user_id: userId,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id", ignoreDuplicates: true });

  await client.from("equipped_items").upsert({
    user_id: userId,
    item_ids: [],
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id", ignoreDuplicates: true });

  for (const itemId of DEFAULT_OWNED_ITEMS) {
    await client.from("inventory").upsert({
      user_id: userId,
      item_id: itemId,
    }, { onConflict: "user_id,item_id", ignoreDuplicates: true });
  }
}

export async function activeSubscription(client: SupabaseClient, userId: string) {
  const today = todayDateString();
  const { data } = await client
    .from("subscriptions")
    .select("plan,billing,status,period_start,period_end,auto_renew,created_at")
    .eq("user_id", userId)
    .eq("status", "active")
    .or(`period_end.is.null,period_end.gte.${today}`)
    .order("period_end", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (data && isPlanId(data.plan)) {
    return {
      plan: data.plan as PlanId,
      billing: isBillingCycle(data.billing) ? data.billing as BillingCycle : "monthly",
      status: data.status ?? "active",
      current_period_start: data.period_start ?? null,
      current_period_end: data.period_end ?? null,
      auto_renew: Boolean(data.auto_renew),
    };
  }

  return {
    plan: "free" as PlanId,
    billing: "monthly" as BillingCycle,
    status: "active",
    current_period_start: null,
    current_period_end: null,
    auto_renew: false,
  };
}

export async function quotaForUser(client: SupabaseClient, userId: string) {
  const subscription = await activeSubscription(client, userId);
  const month = monthKey();
  const { data } = await client
    .from("quota_usage")
    .select("used_seconds")
    .eq("user_id", userId)
    .eq("month", month)
    .maybeSingle();
  return quotaSnapshot(subscription.plan, Number(data?.used_seconds ?? 0));
}

export async function statsForUser(client: SupabaseClient, userId: string) {
  await ensureUserBootstrap(client, userId);
  const { data } = await client
    .from("user_stats")
    .select("points,total_sessions,total_mins,updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  const points = Number(data?.points ?? 0);
  return {
    points,
    total_sessions: Number(data?.total_sessions ?? 0),
    total_mins: Number(data?.total_mins ?? 0),
    updated_at: data?.updated_at ?? new Date().toISOString(),
    ...levelForStats(points),
  };
}

export async function inventoryForUser(client: SupabaseClient, userId: string) {
  await ensureUserBootstrap(client, userId);
  const [{ data: owned }, { data: equipped }] = await Promise.all([
    client.from("inventory").select("item_id").eq("user_id", userId),
    client.from("equipped_items").select("item_ids").eq("user_id", userId).maybeSingle(),
  ]);
  return {
    owned: (owned ?? []).map((row: { item_id: string }) => row.item_id),
    equipped: Array.isArray(equipped?.item_ids) ? equipped.item_ids as string[] : [],
  };
}

export async function activateOrder(client: SupabaseClient, orderIdValue: string, amount: number, tradeNo = "") {
  const { data, error } = await client.rpc("activate_paid_order", {
    p_order_id: orderIdValue,
    p_amount: amount,
    p_trade_no: tradeNo,
  });
  if (error) throw error;
  return data as { status?: string; [key: string]: unknown };
}
