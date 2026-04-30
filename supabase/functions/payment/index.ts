import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { activateOrder, orderId, requireAuthAndRateLimit, serviceClient } from "../_shared/desktop/context.ts";
import { clientIp, fail, ok, parseFormBody, parseJsonBody } from "../_shared/desktop/http.ts";
import { serveJson, pathAfterFunction } from "../_shared/desktop/handler.ts";
import { hitRateLimit } from "../_shared/desktop/rate_limit.ts";
import { getPlan, isBillingCycle, isPlanId, priceForPlan } from "../_shared/desktop/plans.ts";
import {
  createEasyPayOrder,
  getEasyPayConfig,
  normalizeEasyPayStatus,
  queryEasyPayOrder,
  verifyEasyPaySign,
  type EasyPayMethod,
} from "../_shared/desktop/easypay.ts";

async function createPayment(req: Request): Promise<Response> {
  const auth = await requireAuthAndRateLimit(req);
  if (auth instanceof Response) return auth;
  const rate = await hitRateLimit(auth.serviceClient, `payment:user:${auth.publicUserId}`, 5);
  if (rate.limited) return fail("RATE_LIMITED", "请求过频", 429);

  const config = getEasyPayConfig();
  if (!config) return fail("PAYMENT_NOT_CONFIGURED", "支付通道未配置", 503);

  const body = await parseJsonBody(req);
  const planId = body.plan_id;
  const billing = body.billing;
  const method = body.payment_method === "wechat" ? "wechat" : "alipay";
  if (!isPlanId(planId) || planId === "free" || !isBillingCycle(billing)) {
    return fail("PLAN_REQUIRED", "请选择有效付费套餐", 402);
  }

  const amount = priceForPlan(planId, billing);
  const id = orderId();
  const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
  const plan = getPlan(planId);
  await auth.serviceClient.from("orders").insert({
    id,
    user_id: auth.publicUserId,
    plan_id: planId,
    billing,
    amount,
    currency: "CNY",
    payment_method: method,
    status: "pending",
    expires_at: expiresAt,
  });

  try {
    const payment = await createEasyPayOrder(config, {
      orderId: id,
      amount,
      method: method as EasyPayMethod,
      productName: `Desktop Cat ${plan.name} ${billing === "yearly" ? "年付" : "月付"}`,
      clientIp: clientIp(req),
    });
    await auth.serviceClient.from("orders").update({
      trade_no: payment.tradeNo || null,
      pay_url: payment.payUrl,
      qr_code_url: null,
    }).eq("id", id);
    return ok({
      order_id: id,
      amount,
      currency: "CNY",
      payment_method: method,
      pay_url: payment.payUrl,
      qr_code: payment.qrCode,
      qr_code_url: null,
      expires_at: expiresAt,
    });
  } catch (error) {
    await auth.serviceClient.from("orders").update({ status: "failed" }).eq("id", id);
    return fail("PAYMENT_FAILED", error instanceof Error ? error.message : "创建支付失败", 400);
  }
}

async function getOrder(req: Request, orderIdValue: string): Promise<Response> {
  const auth = await requireAuthAndRateLimit(req);
  if (auth instanceof Response) return auth;
  const { data: order } = await auth.serviceClient
    .from("orders")
    .select("id,user_id,plan_id,billing,amount,currency,payment_method,status,trade_no,pay_url,qr_code_url,paid_at,expires_at")
    .eq("id", orderIdValue)
    .eq("user_id", auth.publicUserId)
    .maybeSingle();
  if (!order) return fail("ORDER_NOT_FOUND", "订单不存在", 404);

  let status = String(order.status);
  if (status === "pending" && Date.parse(order.expires_at) < Date.now()) {
    status = "expired";
    await auth.serviceClient.from("orders").update({ status }).eq("id", orderIdValue);
  } else if (status === "pending") {
    const config = getEasyPayConfig();
    if (config) {
      try {
        const queried = await queryEasyPayOrder(config, orderIdValue);
        if (normalizeEasyPayStatus(queried.status) === "paid") {
          const activation = await activateOrder(
            auth.serviceClient,
            orderIdValue,
            Number(queried.money ?? order.amount),
            queried.trade_no ?? order.trade_no ?? "",
          );
          if (activation.status === "paid" || activation.status === "duplicate") status = "paid";
        }
      } catch {
        // Polling should not fail just because the upstream query is temporarily unavailable.
      }
    }
  }

  return ok({
    order_id: order.id,
    status,
    plan: order.plan_id,
    billing: order.billing,
    amount: Number(order.amount),
    currency: order.currency,
    payment_method: order.payment_method,
    pay_url: order.pay_url,
    qr_code_url: order.qr_code_url,
    paid_at: order.paid_at,
    expires_at: order.expires_at,
  });
}

async function webhook(req: Request): Promise<Response> {
  const config = getEasyPayConfig();
  if (!config) return new Response("fail", { status: 503 });
  const params = await parseFormBody(req);
  const paramsForSign = { ...params };
  delete paramsForSign.inst;
  if (!verifyEasyPaySign(paramsForSign, config.key)) return new Response("fail", { status: 400 });
  if (params.pid && params.pid !== config.pid) return new Response("fail", { status: 400 });

  const outTradeNo = typeof params.out_trade_no === "string" ? params.out_trade_no.trim() : "";
  const amount = Number(params.money ?? 0);
  if (!outTradeNo || !Number.isFinite(amount) || amount <= 0) return new Response("fail", { status: 400 });
  const isPaid = params.trade_status === "TRADE_SUCCESS" || params.trade_status === "TRADE_FINISHED" || String(params.status) === "1";
  if (!isPaid) return new Response("success", { status: 200 });

  const result = await activateOrder(serviceClient(), outTradeNo, amount, params.trade_no ?? "");
  if (result.status === "not_found" || result.status === "amount_mismatch") return new Response("fail", { status: 400 });
  return new Response("success", { status: 200 });
}

serve(serveJson(async (req) => {
  const path = pathAfterFunction(req, "payment");
  if (req.method === "POST" && path === "/create") return createPayment(req);
  if (req.method === "POST" && path === "/webhook/epay") return webhook(req);
  if (req.method === "GET" && path.startsWith("/order/")) {
    return getOrder(req, decodeURIComponent(path.replace("/order/", "")));
  }
  return fail("NOT_FOUND", "接口不存在", 404);
}));
