import { useCallback, useEffect, useMemo, useState } from "react";
import { useInterval } from "../../../hooks/useInterval";
import {
  CLOUD_PLANS,
  CLOUD_SHOP_ITEMS,
  normalizeCloudUser,
  normalizeLeaderboardEntry,
  normalizeOrder,
  normalizePlan,
  normalizeQuota,
  normalizeShopItem,
  normalizeSubscription,
  type BillingCycle,
  type CloudEnvelope,
  type CloudPlan,
  type CloudSubscription,
  type CloudUser,
  type LeaderboardEntry,
  type PaymentMethod,
  type PaymentOrder,
  type PlanId,
  type QuotaSnapshot,
  type ShopItem,
} from "../../../shared/cloud";
import { buildDailyStats, buildWeekStats, sessionMinutes } from "../../../shared/stats";
import { rendererCloudApi } from "../../../shared/cloud-api";
import { createTask } from "../../../shared/tasks";
import type { ActiveSession, FocusSession, TimelineEntry, TodayTask } from "../../../shared/types";
import type { DashboardTab } from "../constants";

export function formatTimer(totalSeconds: number): string {
  const seconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(seconds / 60);
  const rem = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
}

function getPoints(sessions: FocusSession[]): number {
  return sessions.reduce((sum, session) => sum + sessionMinutes(session), 0);
}

function unwrap<T>(payload: unknown): CloudEnvelope<T> {
  const result = payload && typeof payload === "object" ? payload as CloudEnvelope<T> : null;
  if (result?.ok) return result;
  return {
    ok: false,
    error: result?.error ?? { code: "UNKNOWN", message: "云端请求失败" },
  };
}

function cloudMessage(payload: unknown): string {
  const item = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  return typeof item.message === "string" ? item.message : "";
}

export function useDashboardState() {
  const [tasks, setTasks] = useState<TodayTask[]>([]);
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [newTaskText, setNewTaskText] = useState("");
  const [focusName, setFocusName] = useState("");
  const [duration, setDuration] = useState(25);
  const [customDuration, setCustomDuration] = useState("");
  const [activeTab, setActiveTab] = useState<DashboardTab>("tasks");
  const [now, setNow] = useState(Date.now());
  const [detectorStatus, setDetectorStatus] = useState("");
  const [equipped, setEquipped] = useState<string[]>([]);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authPasswordConfirm, setAuthPasswordConfirm] = useState("");
  const [cloudUser, setCloudUser] = useState<CloudUser | null>(null);
  const [cloudStatus, setCloudStatus] = useState("离线可用");
  const [cloudBusy, setCloudBusy] = useState(false);
  const [quota, setQuota] = useState<QuotaSnapshot | null>(null);
  const [plans, setPlans] = useState<CloudPlan[]>(CLOUD_PLANS);
  const [subscription, setSubscription] = useState<CloudSubscription | null>(null);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("alipay");
  const [paymentOrder, setPaymentOrder] = useState<PaymentOrder | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [shopItems, setShopItems] = useState<ShopItem[]>(CLOUD_SHOP_ITEMS);
  const [ownedItems, setOwnedItems] = useState<string[]>([]);

  const refreshCloud = useCallback(async () => {
    const me = unwrap<unknown>(await window.desktopCat.auth.me());
    if (!me.ok) {
      setCloudUser(null);
      setQuota(null);
      setSubscription(null);
      setOwnedItems([]);
      setCloudStatus(me.error?.message ?? "未登录，保留本地模式");
      return;
    }

    const user = normalizeCloudUser(me.data);
    setCloudUser(user);
    setQuota(user?.quota ?? null);
    setCloudStatus("云端已连接");

    const [subPayload, inventoryPayload, leaderboardPayload] = await Promise.all([
      window.desktopCat.billing.getSubscription(),
      window.desktopCat.shopCloud.getInventory(),
      window.desktopCat.cloud.getLeaderboard(10),
    ]);

    const sub = unwrap<unknown>(subPayload);
    if (sub.ok) setSubscription(normalizeSubscription(sub.data));

    const inventory = unwrap<{ owned?: string[]; equipped?: string[] }>(inventoryPayload);
    if (inventory.ok) {
      setOwnedItems(Array.isArray(inventory.data?.owned) ? inventory.data.owned : []);
      if (Array.isArray(inventory.data?.equipped)) {
        setEquipped(inventory.data.equipped);
        await window.desktopCat.cat.equipItems(inventory.data.equipped);
      }
    }

    const board = unwrap<{ rank?: number | null; leaderboard?: unknown[] }>(leaderboardPayload);
    if (board.ok) {
      setMyRank(typeof board.data?.rank === "number" ? board.data.rank : null);
      setLeaderboard((board.data?.leaderboard ?? []).map(normalizeLeaderboardEntry));
    }
  }, []);

  useEffect(() => {
    void Promise.all([
      window.desktopCat.tasks.list(),
      window.desktopCat.sessions.list(),
      window.desktopCat.sessions.timeline(),
      window.desktopCat.sessions.get(),
      window.desktopCat.cat.getEquipped(),
      window.desktopCat.billing.getPlans(),
      window.desktopCat.shopCloud.getItems(),
      window.desktopCat.auth.session(),
    ]).then(([loadedTasks, loadedSessions, loadedTimeline, session, loadedEquipped, planPayload, shopPayload, authSession]) => {
      setTasks(loadedTasks);
      setSessions(loadedSessions);
      setTimeline(loadedTimeline);
      setActiveSession(session);
      setEquipped(loadedEquipped);

      const loadedPlans = unwrap<{ plans?: unknown[] }>(planPayload);
      if (loadedPlans.ok && Array.isArray(loadedPlans.data?.plans)) {
        setPlans(loadedPlans.data.plans.map(normalizePlan));
      }

      const loadedShop = unwrap<{ items?: unknown[] }>(shopPayload);
      if (loadedShop.ok && Array.isArray(loadedShop.data?.items)) {
        setShopItems(loadedShop.data.items.map(normalizeShopItem));
      }

      if (authSession && typeof authSession === "object" && "access_token" in authSession) {
        void refreshCloud();
      }

      if (!session) {
        const first = loadedTasks.find((task) => !task.done);
        if (first) {
          setSelectedTaskId(first.id);
          setFocusName(first.text);
        }
      }
    });

    const cleanups = [
      window.desktopCat.events.onTimeline((entry) => setTimeline((items) => [...items, entry])),
      window.desktopCat.events.onSessionChanged((session) => {
        setActiveSession(session);
        if (!session) void window.desktopCat.sessions.list().then(setSessions);
      }),
      window.desktopCat.events.onDistractDetected(() => {
        void window.desktopCat.sessions.get().then(setActiveSession);
      }),
      window.desktopCat.events.onDetectorStatus(setDetectorStatus),
      window.desktopCat.cloud.onChanged((payload) => {
        const message = cloudMessage(payload);
        if (message) setCloudStatus(message);
        void refreshCloud();
      }),
    ];

    return () => cleanups.forEach((cleanup) => cleanup());
  }, [refreshCloud]);

  useInterval(() => setNow(Date.now()), 1000);

  useInterval(() => {
    if (!paymentOrder || paymentOrder.status !== "pending") return;
    void rendererCloudApi.getPaymentOrder(paymentOrder.orderId).then((result) => {
      if (!result.ok) return;
      const order = normalizeOrder(result.data);
      if (!order) return;
      setPaymentOrder((current) => ({
        ...order,
        qrCode: order.qrCode ?? current?.qrCode,
        qrCodeUrl: order.qrCodeUrl ?? current?.qrCodeUrl,
      }));
      if (order.status === "paid") {
        setCloudStatus("支付完成，套餐已激活");
        void refreshCloud();
      }
    });
  }, paymentOrder?.status === "pending" ? 3000 : null);

  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? null;
  const dailyStats = useMemo(() => buildDailyStats(tasks, sessions), [tasks, sessions]);
  const weekStats = useMemo(() => buildWeekStats(sessions), [sessions]);
  const localPoints = getPoints(sessions);
  const points = cloudUser?.stats.points ?? localPoints;
  const elapsedSeconds = activeSession ? Math.floor((now - activeSession.startTime) / 1000) : 0;
  const totalSeconds = activeSession ? activeSession.duration * 60 : duration * 60;
  const remainingSeconds = Math.max(0, totalSeconds - elapsedSeconds);
  const progress = activeSession ? Math.min(100, (elapsedSeconds / totalSeconds) * 100) : 0;

  async function persistTasks(next: TodayTask[]) {
    setTasks(next);
    await window.desktopCat.tasks.save(next);
  }

  async function addTask() {
    const text = newTaskText.trim();
    if (!text) return;
    const task = createTask(text);
    const next = [...tasks, task];
    setNewTaskText("");
    setSelectedTaskId(task.id);
    setFocusName(task.text);
    await persistTasks(next);
  }

  async function toggleTask(task: TodayTask) {
    const next = tasks.map((item) => item.id === task.id ? { ...item, done: !item.done } : item);
    if (!task.done && selectedTaskId === task.id) {
      setSelectedTaskId(null);
      setFocusName("");
    }
    await persistTasks(next);
  }

  async function removeTask(task: TodayTask) {
    const next = tasks.filter((item) => item.id !== task.id);
    if (selectedTaskId === task.id) {
      setSelectedTaskId(null);
      setFocusName("");
    }
    await persistTasks(next);
  }

  function pickTask(task: TodayTask) {
    if (task.done) return;
    setSelectedTaskId(task.id);
    setFocusName(task.text);
  }

  async function startFocus() {
    const name = focusName.trim();
    if (!name || activeSession) return;
    if (!cloudUser) {
      setCloudStatus("请先登录，登录后可使用每月 5 小时免费 AI 分心检测。");
      setActiveTab("profile");
      return;
    }
    const nextSession = await window.desktopCat.sessions.start({ name, duration });
    setActiveSession(nextSession);
    setDetectorStatus("");
  }

  async function finishSession() {
    const ended = await window.desktopCat.sessions.end({ completedTaskId: selectedTaskId });
    if (!ended) return;
    const nextSessions = await window.desktopCat.sessions.list();
    setSessions(nextSessions);
    if (selectedTaskId) {
      const nextTasks = tasks.map((task) => task.id === selectedTaskId ? { ...task, done: true } : task);
      await persistTasks(nextTasks);
    }
    setActiveSession(null);
    setSelectedTaskId(null);
    setFocusName("");
    setActiveTab("summary");
  }

  async function toggleEquip(id: string) {
    if (!cloudUser) {
      setCloudStatus("请先登录，登录后可购买并同步云端装扮。");
      setActiveTab("profile");
      return;
    }

    if (cloudUser) {
      const action = equipped.includes(id) ? "unequip" : "equip";
      const result = unwrap<{ equipped?: string[] }>(await window.desktopCat.shopCloud.equip(id, action));
      if (result.ok && Array.isArray(result.data?.equipped)) {
        setEquipped(result.data.equipped);
        await window.desktopCat.cat.equipItems(result.data.equipped);
      } else {
        setCloudStatus(result.error?.message ?? "装备失败");
      }
      return;
    }
  }

  async function buyItem(id: string) {
    if (!cloudUser) {
      setCloudStatus("请先登录，登录后可购买并同步云端装扮。");
      setActiveTab("profile");
      return;
    }

    const result = unwrap<{ owned?: string[]; points_remaining?: number }>(await window.desktopCat.shopCloud.buy(id));
    if (!result.ok) {
      setCloudStatus(result.error?.message ?? "购买失败");
      return;
    }
    if (Array.isArray(result.data?.owned)) setOwnedItems(result.data.owned);
    setCloudStatus("购买成功");
    await refreshCloud();
  }

  async function signIn(mode: "signin" | "signup") {
    if (mode === "signup" && authPassword !== authPasswordConfirm) {
      setCloudStatus("两次输入的密码不一致。");
      return;
    }

    setCloudBusy(true);
    const result = unwrap<unknown>(
      mode === "signin"
        ? await window.desktopCat.auth.signin({ email: authEmail, password: authPassword })
        : await window.desktopCat.auth.signup({ email: authEmail, password: authPassword }),
    );
    setCloudBusy(false);
    if (!result.ok) {
      setCloudStatus(result.error?.message ?? "登录失败");
      return;
    }
    setAuthPassword("");
    setAuthPasswordConfirm("");
    setCloudStatus(mode === "signin" ? "登录成功" : "注册成功");
    await refreshCloud();
  }

  async function signOut() {
    await window.desktopCat.auth.signout();
    setCloudUser(null);
    setQuota(null);
    setSubscription(null);
    setOwnedItems([]);
    setCloudStatus("已退出云端账号，本地模式继续可用");
  }

  async function createPayment(planId: PlanId) {
    setCloudBusy(true);
    const result = await rendererCloudApi.createPayment({
      plan_id: planId,
      billing: billingCycle,
      payment_method: paymentMethod,
    });
    setCloudBusy(false);
    if (!result.ok) {
      setCloudStatus(result.error?.message ?? "创建订单失败");
      return;
    }
    const order = normalizeOrder(result.data);
    setPaymentOrder(order);
    setCloudStatus(order ? "订单已创建，等待支付" : "订单创建失败");
  }

  function closePayment() {
    setPaymentOrder(null);
  }

  useEffect(() => {
    if (activeSession && remainingSeconds <= 0) {
      void finishSession();
    }
  }, [activeSession, remainingSeconds]);

  return {
    activeSession,
    activeTab,
    authEmail,
    authPassword,
    authPasswordConfirm,
    billingCycle,
    cloudBusy,
    cloudStatus,
    cloudUser,
    customDuration,
    dailyStats,
    detectorStatus,
    duration,
    equipped,
    focusName,
    leaderboard,
    myRank,
    newTaskText,
    ownedItems,
    paymentMethod,
    paymentOrder,
    plans,
    points,
    progress,
    quota,
    remainingSeconds,
    selectedTask,
    selectedTaskId,
    sessions,
    requiresLoginToFocus: !cloudUser,
    shopItems,
    subscription,
    tasks,
    timeline,
    weekStats,
    addTask,
    buyItem,
    closePayment,
    createPayment,
    finishSession,
    pickTask,
    refreshCloud,
    removeTask,
    setActiveTab,
    setAuthEmail,
    setAuthPassword,
    setAuthPasswordConfirm,
    setBillingCycle,
    setCustomDuration,
    setDuration,
    setFocusName,
    setNewTaskText,
    setPaymentMethod,
    setSelectedTaskId,
    signIn,
    signOut,
    startFocus,
    toggleEquip,
    toggleTask,
  };
}

export type DashboardState = ReturnType<typeof useDashboardState>;
