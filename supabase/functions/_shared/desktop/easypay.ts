import { md5 } from "./md5.ts";

export type EasyPayConfig = {
  pid: string;
  key: string;
  apiBase: string;
  notifyUrl: string;
  returnUrl: string;
  cid?: string;
  cidAlipay?: string;
  cidWxpay?: string;
};

export type EasyPayMethod = "alipay" | "wechat";

export type EasyPayCreateResult = {
  trade_no?: string;
  payurl?: string;
  payurl2?: string;
  qrcode?: string;
  img?: string;
  code?: number;
  msg?: string;
};

export type EasyPayOrderResult = {
  code?: number;
  msg?: string;
  trade_no?: string;
  out_trade_no?: string;
  money?: string;
  status?: number | string;
  endtime?: string;
};

export function getEasyPayConfig(): EasyPayConfig | null {
  const pid = Deno.env.get("EPAY_PID") || Deno.env.get("EASY_PAY_PID") || "";
  const key = Deno.env.get("EPAY_KEY") || Deno.env.get("EASY_PAY_PKEY") || "";
  const apiBase = (Deno.env.get("EPAY_GATEWAY") || Deno.env.get("EASY_PAY_API_BASE") || "").replace(/\/+$/, "");
  const notifyUrl = Deno.env.get("EPAY_NOTIFY_URL") || Deno.env.get("EASY_PAY_NOTIFY_URL") || "";
  const returnUrl = Deno.env.get("EPAY_RETURN_URL") || Deno.env.get("EASY_PAY_RETURN_URL") || notifyUrl;
  const cid = Deno.env.get("EPAY_CID") || Deno.env.get("EASY_PAY_CID") || "";
  const cidAlipay = Deno.env.get("EPAY_CID_ALIPAY") || Deno.env.get("EASY_PAY_CID_ALIPAY") || "";
  const cidWxpay = Deno.env.get("EPAY_CID_WXPAY") || Deno.env.get("EASY_PAY_CID_WXPAY") || "";
  if (!pid || !key || !apiBase || !notifyUrl || !returnUrl) return null;
  return {
    pid,
    key,
    apiBase,
    notifyUrl,
    returnUrl,
    cid: normalizeCidList(cid),
    cidAlipay: normalizeCidList(cidAlipay),
    cidWxpay: normalizeCidList(cidWxpay),
  };
}

export function mapPaymentMethod(method: unknown): "alipay" | "wxpay" {
  return method === "wechat" || method === "wxpay" ? "wxpay" : "alipay";
}

function normalizeCidList(cid?: string): string | undefined {
  if (!cid) return undefined;
  const normalized = cid
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .join(",");
  return normalized || undefined;
}

function resolveCid(config: EasyPayConfig, method: EasyPayMethod): string | undefined {
  if (method === "alipay") return config.cidAlipay || config.cid;
  if (method === "wechat") return config.cidWxpay || config.cid;
  return config.cid;
}

export function buildEasyPaySignSource(params: Record<string, string>): string {
  return Object.entries(params)
    .filter(([key, value]) => key !== "sign" && key !== "sign_type" && value !== "")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
}

export function generateEasyPaySign(params: Record<string, string>, key: string): string {
  return md5(`${buildEasyPaySignSource(params)}${key}`);
}

export function verifyEasyPaySign(params: Record<string, string>, key: string): boolean {
  const sign = params.sign || "";
  if (!sign) return false;
  const expected = generateEasyPaySign(params, key);
  return expected.toLowerCase() === sign.toLowerCase();
}

export async function createEasyPayOrder(config: EasyPayConfig, input: {
  orderId: string;
  amount: number;
  method: EasyPayMethod;
  productName: string;
  clientIp: string;
}): Promise<{
  tradeNo: string;
  payUrl?: string;
  qrCode: string;
  raw: EasyPayCreateResult;
}> {
  const params: Record<string, string> = {
    pid: config.pid,
    type: mapPaymentMethod(input.method),
    out_trade_no: input.orderId,
    notify_url: config.notifyUrl,
    return_url: config.returnUrl,
    name: input.productName,
    money: input.amount.toFixed(2),
    clientip: input.clientIp,
  };
  const cid = resolveCid(config, input.method);
  if (cid) params.cid = cid;
  params.sign = generateEasyPaySign(params, config.key);
  params.sign_type = "MD5";

  const response = await fetch(`${config.apiBase}/mapi.php`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
    signal: AbortSignal.timeout(10_000),
  });
  const raw = await response.json() as EasyPayCreateResult;
  if (raw.code !== 1) {
    throw new Error(raw.msg || "EasyPay create order failed");
  }

  const payUrl = raw.payurl || raw.payurl2 || raw.img || "";
  const qrCode = raw.qrcode || "";
  if (!payUrl && !qrCode) throw new Error("EasyPay response missing payment payload");

  return {
    tradeNo: raw.trade_no || "",
    ...(payUrl ? { payUrl } : {}),
    qrCode,
    raw,
  };
}

export async function queryEasyPayOrder(config: EasyPayConfig, orderId: string): Promise<EasyPayOrderResult> {
  const params = new URLSearchParams({
    act: "order",
    pid: config.pid,
    key: config.key,
    out_trade_no: orderId,
  });
  const response = await fetch(`${config.apiBase}/api.php?${params.toString()}`, {
    method: "GET",
    signal: AbortSignal.timeout(10_000),
  });
  const raw = await response.json() as EasyPayOrderResult;
  if (raw.code !== 1) {
    throw new Error(raw.msg || "EasyPay query order failed");
  }
  return raw;
}

export function normalizeEasyPayStatus(value: unknown): "paid" | "pending" {
  return String(value) === "1" ? "paid" : "pending";
}
