import type { CloudEnvelope } from "./cloud";

type RendererAuthSession = {
  access_token?: string;
};

type CloudApiRequestOptions = {
  method?: "GET" | "POST";
  auth?: boolean;
  body?: unknown;
  getApiBase?: () => Promise<string>;
  getAuthSession?: () => Promise<RendererAuthSession | unknown>;
};

function asEnvelope<T>(payload: unknown, fallbackCode = "UNKNOWN", fallbackMessage = "云端请求失败"): CloudEnvelope<T> {
  const result = payload && typeof payload === "object" ? payload as CloudEnvelope<T> : null;
  if (result?.ok) return result;
  return {
    ok: false,
    error: result?.error ?? { code: fallbackCode, message: fallbackMessage },
  };
}

async function parseResponse<T>(response: Response): Promise<CloudEnvelope<T>> {
  const text = await response.text();
  if (!text) {
    return response.ok
      ? { ok: true } as CloudEnvelope<T>
      : { ok: false, error: { code: `HTTP_${response.status}`, message: "云端请求失败" } };
  }

  try {
    return asEnvelope<T>(JSON.parse(text), `HTTP_${response.status}`, text.slice(0, 180));
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

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

export async function cloudApiRequest<T = unknown>(
  path: string,
  options: CloudApiRequestOptions = {},
): Promise<CloudEnvelope<T>> {
  const method = options.method ?? "GET";
  const getApiBase = options.getApiBase ?? window.desktopCat.cloud.getApiBase;
  const getAuthSession = options.getAuthSession ?? window.desktopCat.auth.session;
  const session = options.auth ? await getAuthSession() : null;
  const accessToken = session && typeof session === "object" && "access_token" in session
    ? (session as RendererAuthSession).access_token
    : undefined;

  if (options.auth && !accessToken) {
    return { ok: false, error: { code: "UNAUTHORIZED", message: "请先登录" } };
  }

  try {
    const apiBase = normalizeBaseUrl(await getApiBase());
    const response = await fetch(`${apiBase}${path.startsWith("/") ? path : `/${path}`}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    return parseResponse<T>(response);
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "NETWORK_ERROR",
        message: error instanceof Error ? error.message : "网络请求失败",
      },
    };
  }
}

export const rendererCloudApi = {
  createPayment: (payload: { plan_id: string; billing: string; payment_method: string }) =>
    cloudApiRequest("/payment/create", { method: "POST", auth: true, body: payload }),
  getPaymentOrder: (orderId: string) =>
    cloudApiRequest(`/payment/order/${encodeURIComponent(orderId)}`, { auth: true }),
};
