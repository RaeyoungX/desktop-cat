export type EasyPayPaymentMethod = "alipay" | "wechat";

export type EasyPayCreateResponse = {
  code?: number;
  msg?: string;
  trade_no?: string;
  payurl?: string;
  payurl2?: string;
  qrcode?: string;
  img?: string;
};

export type NormalizedPaymentLink = {
  tradeNo: string;
  payUrl: string;
  qrCodeUrl: string;
};

export function mapPaymentMethod(method: string): "alipay" | "wxpay" {
  return method === "wechat" || method === "wxpay" ? "wxpay" : "alipay";
}

export function buildEasyPaySignSource(params: Record<string, string>): string {
  return Object.entries(params)
    .filter((entry): entry is [string, string] => {
      const [key, value] = entry;
      return key !== "sign" && key !== "sign_type" && value !== "";
    })
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
}

export function normalizeEasyPayCreateResponse(response: EasyPayCreateResponse, preferMobile = false): NormalizedPaymentLink {
  if (response.code !== 1) {
    throw new Error(response.msg || "EasyPay create payment failed");
  }
  const tradeNo = response.trade_no || "";
  const payUrl = (preferMobile && response.payurl2) || response.payurl || response.qrcode || response.img || "";
  const qrCodeUrl = response.qrcode || response.img || response.payurl || response.payurl2 || "";
  if (!tradeNo || !payUrl) {
    throw new Error("EasyPay response did not include a usable payment link");
  }
  return { tradeNo, payUrl, qrCodeUrl };
}

export function normalizeEasyPayOrderStatus(value: unknown): "paid" | "pending" {
  return String(value) === "1" ? "paid" : "pending";
}
