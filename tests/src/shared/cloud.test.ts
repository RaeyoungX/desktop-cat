import { describe, expect, it } from "vitest";
import {
  buildQuotaSnapshot,
  getPlan,
  levelForStats,
  normalizeCloudUser,
  normalizeLeaderboardEntry,
  normalizeOrder,
  normalizePlan,
  normalizeQuota,
  normalizeShopItem,
  normalizeSubscription,
  priceForPlan,
  sessionAwardMinutes,
} from "../../../src/shared/cloud";

describe("cloud plan helpers", () => {
  it("uses API.md default plans and prices", () => {
    expect(getPlan("pro")).toMatchObject({ id: "pro", quotaHours: 60, priceMonthly: 15, priceYearly: 148 });
    expect(priceForPlan("power", "yearly")).toBe(258);
  });

  it("builds quota snapshots with remaining hours and reset date", () => {
    expect(buildQuotaSnapshot("light", 3600, new Date("2026-04-30T10:00:00Z"))).toMatchObject({
      plan: "light",
      planHours: 20,
      usedHours: 1,
      remainingHours: 19,
      quotaPct: 5,
      resetAt: "2026-05-01T00:00:00.000Z",
    });
  });

  it("awards focus points from actual focused seconds", () => {
    expect(sessionAwardMinutes(60)).toBe(1);
    expect(sessionAwardMinutes(1490)).toBe(25);
    expect(sessionAwardMinutes(0)).toBe(1);
  });

  it("derives user levels from total minutes", () => {
    expect(levelForStats(0)).toEqual({ level: 1, levelName: "刚认识猫" });
    expect(levelForStats(1300)).toEqual({ level: 5, levelName: "资深监工" });
  });

  it("normalizes API.md snake_case payloads for the React UI", () => {
    expect(normalizePlan({ id: "pro", quota_hours: 60, price_monthly: 15, price_yearly: 148 })).toMatchObject({
      id: "pro",
      quotaHours: 60,
      priceYearly: 148,
    });
    expect(normalizeQuota({ plan: "light", plan_hours: 20, used_hours: 2, remaining_hours: 18, quota_pct: 10, reset_at: "2026-05-01T00:00:00Z" })).toMatchObject({
      plan: "light",
      usedSeconds: 7200,
      remainingHours: 18,
    });
    expect(normalizeShopItem({ id: "hat", icon_color: "#111", icon_bg: "#eee", desc: "cool" })).toMatchObject({
      id: "hat",
      iconColor: "#111",
      iconBg: "#eee",
    });
    expect(normalizeShopItem({ name: "Broken row" })).toBeNull();
    expect(normalizeSubscription({ plan: "power", billing: "yearly", current_period_end: "2027-04-30" })).toMatchObject({
      plan: "power",
      billing: "yearly",
      currentPeriodEnd: "2027-04-30",
    });
    expect(normalizeLeaderboardEntry({ rank: 2, user_id: "abc", total_mins: 30 })).toMatchObject({
      rank: 2,
      userId: "abc",
      totalMins: 30,
    });
    expect(normalizeOrder({
      order_id: "CAT1",
      status: "paid",
      plan: "pro",
      amount: 15,
      payment_method: "wechat",
      qr_code: "alipays://platformapi/startapp?payload",
      qr_code_url: "https://legacy.example/qr.png",
    })).toMatchObject({
      orderId: "CAT1",
      status: "paid",
      paymentMethod: "wechat",
      qrCode: "alipays://platformapi/startapp?payload",
      qrCodeUrl: "https://legacy.example/qr.png",
    });
    expect(normalizeCloudUser({
      user_id: "user-1",
      email: "rae@example.com",
      plan: "pro",
      plan_expires_at: "2026-12-31",
      quota: { plan: "pro", plan_hours: 60, used_hours: 1, remaining_hours: 59, quota_pct: 1.7 },
      stats: { points: 380, total_sessions: 5, total_mins: 250, level: 3, level_name: "资深监工" },
    })).toMatchObject({
      userId: "user-1",
      stats: { points: 380, totalMins: 250 },
    });
  });
});
