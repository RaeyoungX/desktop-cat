import type { FocusSession } from "../../src/shared/types";
import { getApiBaseUrl, getAuthSession, setAuthSession, type AuthSession } from "./store";

export type CloudApiResult<T = unknown> = {
  ok: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    data?: unknown;
  };
};

type RequestOptions = {
  method?: "GET" | "POST";
  auth?: boolean;
  body?: unknown;
};

function shouldLogCloudApi(): boolean {
  return Boolean(process.env.VITE_DEV_SERVER_URL) || process.env.DESKTOP_CAT_LOG_API === "true";
}

function logCloudApi(message: string, details?: Record<string, unknown>): void {
  if (!shouldLogCloudApi()) return;
  if (details) {
    console.log(`[desktop-cat][api] ${message}`, details);
    return;
  }
  console.log(`[desktop-cat][api] ${message}`);
}

function parseCloudPayload<T>(text: string, response: Response): CloudApiResult<T> {
  if (!text) return { ok: response.ok } as CloudApiResult<T>;

  try {
    return JSON.parse(text) as CloudApiResult<T>;
  } catch {
    return {
      ok: false,
      error: {
        code: `HTTP_${response.status}`,
        message: text.slice(0, 180) || "云端接口返回了非 JSON 响应",
      },
    };
  }
}

function isExpiring(session: AuthSession | null): boolean {
  if (!session?.expires_at) return false;
  return session.expires_at * 1000 < Date.now() + 60_000;
}

function normalizeSession(data: Record<string, unknown>, existing: AuthSession | null = null): AuthSession {
  return {
    access_token: typeof data.access_token === "string" ? data.access_token : existing?.access_token,
    refresh_token: typeof data.refresh_token === "string" ? data.refresh_token : existing?.refresh_token,
    expires_at: typeof data.expires_at === "number" ? data.expires_at : existing?.expires_at,
    email: typeof data.email === "string" ? data.email : existing?.email,
    user_id: typeof data.user_id === "string" ? data.user_id : existing?.user_id,
    user: {
      id: typeof data.user_id === "string" ? data.user_id : existing?.user?.id ?? existing?.user_id ?? "",
      email: typeof data.email === "string" ? data.email : existing?.user?.email ?? existing?.email,
    },
  };
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<CloudApiResult<T>> {
  const method = options.method ?? "GET";
  const startedAt = Date.now();
  let session = getAuthSession();
  if (options.auth && isExpiring(session) && session?.refresh_token) {
    const refreshed = await request<Record<string, unknown>>("/auth/refresh", {
      method: "POST",
      body: { refresh_token: session.refresh_token },
    });
    if (refreshed.ok && refreshed.data) {
      session = normalizeSession(refreshed.data, session);
      setAuthSession(session);
    }
  }

  if (options.auth && !session?.access_token) {
    logCloudApi(`xx ${method} ${path}`, {
      auth: "missing",
      code: "UNAUTHORIZED",
      elapsedMs: Date.now() - startedAt,
    });
    return { ok: false, error: { code: "UNAUTHORIZED", message: "请先登录" } };
  }

  try {
    logCloudApi(`-> ${method} ${path}`, {
      auth: options.auth ? "yes" : "no",
    });
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(options.auth ? { Authorization: `Bearer ${session?.access_token}` } : {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    const text = await response.text();
    const payload = parseCloudPayload<T>(text, response);
    logCloudApi(`<- ${method} ${path}`, {
      status: response.status,
      ok: payload.ok,
      code: payload.error?.code,
      message: payload.error?.message,
      elapsedMs: Date.now() - startedAt,
    });
    if (response.status === 401 && options.auth) setAuthSession(null);
    return payload;
  } catch (error) {
    logCloudApi(`!! ${method} ${path}`, {
      code: "NETWORK_ERROR",
      message: error instanceof Error ? error.message : "网络请求失败",
      elapsedMs: Date.now() - startedAt,
    });
    return {
      ok: false,
      error: {
        code: "NETWORK_ERROR",
        message: error instanceof Error ? error.message : "网络请求失败",
      },
    };
  }
}

function saveAuthFromResult(result: CloudApiResult<Record<string, unknown>>): CloudApiResult<Record<string, unknown>> {
  if (result.ok && result.data) {
    setAuthSession(normalizeSession(result.data));
  }
  return result;
}

export const cloudClient = {
  getAuthSession: () => getAuthSession(),
  signup: async (email: string, password: string) => saveAuthFromResult(await request("/auth/signup", {
    method: "POST",
    body: { email, password },
  })),
  signin: async (email: string, password: string) => saveAuthFromResult(await request("/auth/signin", {
    method: "POST",
    body: { email, password },
  })),
  signout: async () => {
    const result = await request("/auth/signout", { method: "POST", auth: true });
    setAuthSession(null);
    return result;
  },
  refresh: async () => {
    const session = getAuthSession();
    if (!session?.refresh_token) return { ok: false, error: { code: "UNAUTHORIZED", message: "请先登录" } };
    const result = await request<Record<string, unknown>>("/auth/refresh", {
      method: "POST",
      body: { refresh_token: session.refresh_token },
    });
    if (result.ok && result.data) setAuthSession(normalizeSession(result.data, session));
    return result;
  },
  me: () => request("/user", { auth: true }),
  getQuota: () => request("/quota/status", { auth: true }),
  reportQuota: (payload: { session_id: string; duration_seconds: number; status: string; activity?: string }) =>
    request("/quota/report", { method: "POST", auth: true, body: payload }),
  syncSessions: (sessions: FocusSession[]) => request("/sessions/sync", {
    method: "POST",
    auth: true,
    body: {
      sessions: sessions.map((session) => ({
        local_id: session.localId,
        name: session.name,
        duration: session.plannedMinutes,
        actual_seconds: session.actualSeconds,
        start_time: new Date(session.startTime).toISOString(),
        end_time: session.endTime ? new Date(session.endTime).toISOString() : null,
        distract_count: session.distractCount,
      })),
    },
  }),
  syncStats: (stats: { points: number; total_sessions: number; total_mins: number }) =>
    request("/stats/sync", { method: "POST", auth: true, body: stats }),
  getLeaderboard: (limit = 10) => request(`/stats/leaderboard?limit=${encodeURIComponent(String(limit))}`, { auth: true }),
  getPlans: () => request("/plans"),
  getSubscription: () => request("/subscription", { auth: true }),
  getShopItems: () => request("/shop/items"),
  getInventory: () => request("/shop/inventory", { auth: true }),
  buyItem: (itemId: string) => request("/shop/buy", { method: "POST", auth: true, body: { item_id: itemId } }),
  equipItem: (itemId: string, action: "equip" | "unequip") =>
    request("/shop/equip", { method: "POST", auth: true, body: { item_id: itemId, action } }),
};
