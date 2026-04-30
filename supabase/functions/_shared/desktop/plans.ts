export type PlanId = "free" | "light" | "pro" | "power";
export type BillingCycle = "monthly" | "yearly";

export type PlanDefinition = {
  id: PlanId;
  name: string;
  quota_hours: number;
  price_monthly: number;
  price_yearly: number;
};

export const PLANS: PlanDefinition[] = [
  { id: "free", name: "免费版", quota_hours: 5, price_monthly: 0, price_yearly: 0 },
  { id: "light", name: "Light", quota_hours: 20, price_monthly: 3, price_yearly: 28 },
  { id: "pro", name: "Pro", quota_hours: 60, price_monthly: 15, price_yearly: 148 },
  { id: "power", name: "Power", quota_hours: 120, price_monthly: 26, price_yearly: 258 },
];

export const DEFAULT_OWNED_ITEMS = ["bow"];

export function isPlanId(value: unknown): value is PlanId {
  return value === "free" || value === "light" || value === "pro" || value === "power";
}

export function isBillingCycle(value: unknown): value is BillingCycle {
  return value === "monthly" || value === "yearly";
}

export function getPlan(id: unknown): PlanDefinition {
  return PLANS.find((plan) => plan.id === id) ?? PLANS[0];
}

export function priceForPlan(id: PlanId, billing: BillingCycle): number {
  const plan = getPlan(id);
  return billing === "yearly" ? plan.price_yearly : plan.price_monthly;
}

export function monthKey(date = new Date()): string {
  return date.toISOString().slice(0, 7);
}

export function nextMonthResetIso(date = new Date()): string {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1)).toISOString();
}

export function todayDateString(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function addPeriod(date: Date, billing: BillingCycle): Date {
  const next = new Date(date);
  if (billing === "yearly") {
    next.setUTCFullYear(next.getUTCFullYear() + 1);
  } else {
    next.setUTCMonth(next.getUTCMonth() + 1);
  }
  return next;
}

export function quotaSnapshot(planId: PlanId, usedSeconds: number, date = new Date()) {
  const plan = getPlan(planId);
  const planSeconds = Math.max(0, plan.quota_hours * 3600);
  const safeUsed = Math.max(0, Math.round(usedSeconds || 0));
  const remainingSeconds = Math.max(0, planSeconds - safeUsed);
  return {
    plan: plan.id,
    plan_hours: plan.quota_hours,
    used_hours: Number((safeUsed / 3600).toFixed(2)),
    remaining_hours: Number((remainingSeconds / 3600).toFixed(2)),
    quota_pct: planSeconds > 0 ? Number(Math.min(100, (safeUsed / planSeconds) * 100).toFixed(1)) : 100,
    reset_at: nextMonthResetIso(date),
  };
}

export function sessionAwardMinutes(actualSeconds: number, fallbackMinutes = 0): number {
  const roundedActual = Math.floor(Math.max(0, actualSeconds || 0) / 60);
  const fallback = Math.max(0, Math.round(fallbackMinutes || 0));
  return Math.max(1, roundedActual || fallback);
}

export function levelForStats(points: number) {
  if (points >= 1200) return { level: 5, level_name: "传说监工" };
  if (points >= 600) return { level: 4, level_name: "高阶监工" };
  if (points >= 240) return { level: 3, level_name: "资深监工" };
  if (points >= 60) return { level: 2, level_name: "认真猫友" };
  return { level: 1, level_name: "新手猫友" };
}
