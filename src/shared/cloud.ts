export type PlanId = "free" | "light" | "pro" | "power";
export type BillingCycle = "monthly" | "yearly";
export type PaymentMethod = "alipay" | "wechat";
export type OrderStatus = "pending" | "paid" | "expired" | "failed" | "refunded";

export type CloudPlan = {
  id: PlanId;
  name: string;
  quotaHours: number;
  priceMonthly: number;
  priceYearly: number;
};

export type QuotaSnapshot = {
  plan: PlanId;
  planHours: number;
  usedSeconds: number;
  usedHours: number;
  remainingHours: number;
  quotaPct: number;
  resetAt: string;
};

export type CloudEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    data?: unknown;
  };
};

export type ShopItem = {
  id: string;
  name: string;
  icon: string;
  iconColor: string;
  iconBg: string;
  cost: number;
  desc: string;
  available: boolean;
};

export type CloudUser = {
  userId: string;
  email?: string;
  plan: PlanId;
  planExpiresAt: string | null;
  quota: QuotaSnapshot;
  stats: {
    points: number;
    totalSessions: number;
    totalMins: number;
    level: number;
    levelName: string;
  };
};

export type LeaderboardEntry = {
  rank: number;
  userId: string;
  points: number;
  totalMins: number;
  totalSessions?: number;
};

export type CloudSubscription = {
  plan: PlanId;
  billing: BillingCycle;
  status: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  autoRenew: boolean;
};

export type PaymentOrder = {
  orderId: string;
  status: OrderStatus;
  plan: PlanId;
  billing: BillingCycle;
  amount: number;
  currency: string;
  paymentMethod: PaymentMethod;
  payUrl?: string;
  qrCode?: string;
  qrCodeUrl?: string;
  paidAt?: string | null;
  expiresAt?: string;
};

export const CLOUD_PLANS: CloudPlan[] = [
  { id: "free", name: "免费版", quotaHours: 5, priceMonthly: 0, priceYearly: 0 },
  { id: "light", name: "Light", quotaHours: 20, priceMonthly: 3, priceYearly: 28 },
  { id: "pro", name: "Pro", quotaHours: 60, priceMonthly: 15, priceYearly: 148 },
  { id: "power", name: "Power", quotaHours: 120, priceMonthly: 26, priceYearly: 258 },
];

export const CLOUD_SHOP_ITEMS: ShopItem[] = [
  { id: "bow", name: "蝴蝶结", icon: "gift", iconColor: "#db2777", iconBg: "#fce7f3", cost: 25, desc: "优雅满分", available: true },
  { id: "hat", name: "礼帽", icon: "wand-2", iconColor: "#374151", iconBg: "#f3f4f6", cost: 50, desc: "绅士猫咪", available: true },
  { id: "glasses", name: "墨镜", icon: "glasses", iconColor: "#111827", iconBg: "#e5e7eb", cost: 60, desc: "酷到发光", available: true },
  { id: "crown", name: "王冠", icon: "crown", iconColor: "#a16207", iconBg: "#fef3c7", cost: 80, desc: "今日陛下", available: true },
  { id: "stars", name: "星星气", icon: "sparkles", iconColor: "#7c3aed", iconBg: "#ede9fe", cost: 40, desc: "一路闪闪", available: true },
];

export function normalizePlanId(value: unknown): PlanId {
  return value === "light" || value === "pro" || value === "power" ? value : "free";
}

export function getPlan(planId: unknown): CloudPlan {
  const id = normalizePlanId(planId);
  return CLOUD_PLANS.find((plan) => plan.id === id) ?? CLOUD_PLANS[0];
}

export function priceForPlan(planId: PlanId, billing: BillingCycle): number {
  const plan = getPlan(planId);
  return billing === "yearly" ? plan.priceYearly : plan.priceMonthly;
}

export function nextPeriodEnd(billing: BillingCycle, from = new Date()): Date {
  const end = new Date(from);
  if (billing === "yearly") {
    end.setUTCFullYear(end.getUTCFullYear() + 1);
  } else {
    end.setUTCMonth(end.getUTCMonth() + 1);
  }
  return end;
}

export function monthKey(date = new Date()): string {
  return date.toISOString().slice(0, 7);
}

export function nextMonthReset(date = new Date()): string {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1, 0, 0, 0, 0)).toISOString();
}

export function buildQuotaSnapshot(planId: unknown, usedSeconds: number, date = new Date()): QuotaSnapshot {
  const plan = getPlan(planId);
  const safeUsedSeconds = Math.max(0, Math.round(Number(usedSeconds) || 0));
  const planSeconds = plan.quotaHours * 3600;
  const remainingSeconds = Math.max(0, planSeconds - safeUsedSeconds);
  return {
    plan: plan.id,
    planHours: plan.quotaHours,
    usedSeconds: safeUsedSeconds,
    usedHours: Number((safeUsedSeconds / 3600).toFixed(2)),
    remainingHours: Number((remainingSeconds / 3600).toFixed(2)),
    quotaPct: planSeconds > 0 ? Number(Math.min(100, (safeUsedSeconds / planSeconds) * 100).toFixed(1)) : 0,
    resetAt: nextMonthReset(date),
  };
}

export function normalizePlan(raw: unknown): CloudPlan {
  const item = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  return {
    id: normalizePlanId(item.id),
    name: typeof item.name === "string" ? item.name : getPlan(item.id).name,
    quotaHours: Number(item.quota_hours ?? item.quotaHours ?? getPlan(item.id).quotaHours),
    priceMonthly: Number(item.price_monthly ?? item.priceMonthly ?? getPlan(item.id).priceMonthly),
    priceYearly: Number(item.price_yearly ?? item.priceYearly ?? getPlan(item.id).priceYearly),
  };
}

export function normalizeQuota(raw: unknown): QuotaSnapshot {
  const item = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const plan = normalizePlanId(item.plan);
  const usedHours = Number(item.used_hours ?? item.usedHours ?? 0);
  const planHours = Number(item.plan_hours ?? item.planHours ?? getPlan(plan).quotaHours);
  return {
    plan,
    planHours,
    usedSeconds: Math.round(usedHours * 3600),
    usedHours,
    remainingHours: Number(item.remaining_hours ?? item.remainingHours ?? Math.max(0, planHours - usedHours)),
    quotaPct: Number(item.quota_pct ?? item.quotaPct ?? 0),
    resetAt: String(item.reset_at ?? item.resetAt ?? nextMonthReset()),
  };
}

export function normalizeCloudUser(raw: unknown): CloudUser | null {
  const item = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const userId = typeof item.user_id === "string" ? item.user_id : typeof item.userId === "string" ? item.userId : "";
  if (!userId) return null;
  const statsRaw = item.stats && typeof item.stats === "object" ? item.stats as Record<string, unknown> : {};
  return {
    userId,
    email: typeof item.email === "string" ? item.email : undefined,
    plan: normalizePlanId(item.plan),
    planExpiresAt: typeof item.plan_expires_at === "string" ? item.plan_expires_at : item.planExpiresAt as string | null ?? null,
    quota: normalizeQuota(item.quota),
    stats: {
      points: Number(statsRaw.points ?? 0),
      totalSessions: Number(statsRaw.total_sessions ?? statsRaw.totalSessions ?? 0),
      totalMins: Number(statsRaw.total_mins ?? statsRaw.totalMins ?? 0),
      level: Number(statsRaw.level ?? 1),
      levelName: String(statsRaw.level_name ?? statsRaw.levelName ?? "刚认识猫"),
    },
  };
}

export function normalizeShopItem(raw: unknown): ShopItem {
  const item = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const fallback = CLOUD_SHOP_ITEMS.find((candidate) => candidate.id === item.id) ?? CLOUD_SHOP_ITEMS[0];
  return {
    id: String(item.id ?? fallback.id),
    name: String(item.name ?? fallback.name),
    icon: String(item.icon ?? fallback.icon),
    iconColor: String(item.icon_color ?? item.iconColor ?? fallback.iconColor),
    iconBg: String(item.icon_bg ?? item.iconBg ?? fallback.iconBg),
    cost: Number(item.cost ?? fallback.cost),
    desc: String(item.desc ?? item.description ?? fallback.desc),
    available: item.available !== false,
  };
}

export function normalizeSubscription(raw: unknown): CloudSubscription {
  const item = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  return {
    plan: normalizePlanId(item.plan),
    billing: item.billing === "yearly" ? "yearly" : "monthly",
    status: String(item.status ?? "active"),
    currentPeriodStart: typeof item.current_period_start === "string" ? item.current_period_start : item.currentPeriodStart as string | null ?? null,
    currentPeriodEnd: typeof item.current_period_end === "string" ? item.current_period_end : item.currentPeriodEnd as string | null ?? null,
    autoRenew: Boolean(item.auto_renew ?? item.autoRenew),
  };
}

export function normalizeLeaderboardEntry(raw: unknown, index = 0): LeaderboardEntry {
  const item = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  return {
    rank: Number(item.rank ?? index + 1),
    userId: String(item.user_id ?? item.userId ?? ""),
    points: Number(item.points ?? 0),
    totalMins: Number(item.total_mins ?? item.totalMins ?? 0),
    totalSessions: Number(item.total_sessions ?? item.totalSessions ?? 0),
  };
}

export function normalizeOrder(raw: unknown): PaymentOrder | null {
  const item = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const orderId = typeof item.order_id === "string" ? item.order_id : typeof item.orderId === "string" ? item.orderId : "";
  if (!orderId) return null;
  return {
    orderId,
    status: ["pending", "paid", "expired", "failed", "refunded"].includes(String(item.status))
      ? item.status as OrderStatus
      : "pending",
    plan: normalizePlanId(item.plan),
    billing: item.billing === "yearly" ? "yearly" : "monthly",
    amount: Number(item.amount ?? 0),
    currency: String(item.currency ?? "CNY"),
    paymentMethod: item.payment_method === "wechat" || item.paymentMethod === "wechat" ? "wechat" : "alipay",
    payUrl: typeof item.pay_url === "string" ? item.pay_url : typeof item.payUrl === "string" ? item.payUrl : undefined,
    qrCode: typeof item.qr_code === "string" ? item.qr_code : typeof item.qrCode === "string" ? item.qrCode : undefined,
    qrCodeUrl: typeof item.qr_code_url === "string" ? item.qr_code_url : typeof item.qrCodeUrl === "string" ? item.qrCodeUrl : undefined,
    paidAt: typeof item.paid_at === "string" ? item.paid_at : item.paidAt as string | null ?? null,
    expiresAt: typeof item.expires_at === "string" ? item.expires_at : typeof item.expiresAt === "string" ? item.expiresAt : undefined,
  };
}

export function sessionAwardMinutes(actualSeconds: number): number {
  return Math.max(1, Math.round(Math.max(0, actualSeconds) / 60));
}

export function levelForStats(totalMins: number): { level: number; levelName: string } {
  if (totalMins >= 3000) return { level: 6, levelName: "传说监工" };
  if (totalMins >= 1200) return { level: 5, levelName: "资深监工" };
  if (totalMins >= 500) return { level: 4, levelName: "稳定巡逻员" };
  if (totalMins >= 180) return { level: 3, levelName: "专注熟手" };
  if (totalMins >= 60) return { level: 2, levelName: "新晋铲屎官" };
  return { level: 1, levelName: "刚认识猫" };
}
