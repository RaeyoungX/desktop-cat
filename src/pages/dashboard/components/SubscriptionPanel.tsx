import { Check, CreditCard, QrCode } from "lucide-react";
import type { BillingCycle, CloudPlan, CloudSubscription, PaymentMethod, PaymentOrder, PlanId } from "../../../shared/cloud";

type SubscriptionPanelProps = {
  billingCycle: BillingCycle;
  cloudBusy: boolean;
  cloudStatus: string;
  paymentMethod: PaymentMethod;
  paymentOrder: PaymentOrder | null;
  plans: CloudPlan[];
  subscription: CloudSubscription | null;
  onBillingChange: (value: BillingCycle) => void;
  onClosePayment: () => void;
  onCreatePayment: (planId: PlanId) => void;
  onPaymentMethodChange: (value: PaymentMethod) => void;
};

function price(plan: CloudPlan, billing: BillingCycle): number {
  return billing === "yearly" ? plan.priceYearly : plan.priceMonthly;
}

export function SubscriptionPanel({
  billingCycle,
  cloudBusy,
  cloudStatus,
  paymentMethod,
  paymentOrder,
  plans,
  subscription,
  onBillingChange,
  onClosePayment,
  onCreatePayment,
  onPaymentMethodChange,
}: SubscriptionPanelProps) {
  return (
    <main className="panel-stack">
      <section className="subscription-hero">
        <img src="/assets/cat-loaf.png" alt="" />
        <div>
          <strong>{subscription ? `${subscription.plan.toUpperCase()} 套餐` : "订阅套餐"}</strong>
          <span>{subscription?.currentPeriodEnd ? `有效至 ${subscription.currentPeriodEnd}` : cloudStatus}</span>
        </div>
      </section>

      <section className="segmented">
        <button className={billingCycle === "monthly" ? "active" : ""} onClick={() => onBillingChange("monthly")}>月付</button>
        <button className={billingCycle === "yearly" ? "active" : ""} onClick={() => onBillingChange("yearly")}>年付</button>
      </section>

      <section className="plan-grid">
        {plans.map((plan) => {
          const active = subscription?.plan === plan.id;
          const amount = price(plan, billingCycle);
          return (
            <article className={`plan-card ${active ? "current" : ""}`} key={plan.id}>
              <div>
                <strong>{plan.name}</strong>
                <span>{plan.quotaHours} 小时 AI 检测 / 月</span>
              </div>
              <b>¥{amount}</b>
              {plan.id === "free" || active ? (
                <button disabled><Check size={14} />{active ? "当前" : "基础"}</button>
              ) : (
                <button disabled={cloudBusy} onClick={() => onCreatePayment(plan.id)}><CreditCard size={14} />购买</button>
              )}
            </article>
          );
        })}
      </section>

      <section className="segmented payment-method">
        <button className={paymentMethod === "alipay" ? "active" : ""} onClick={() => onPaymentMethodChange("alipay")}>支付宝</button>
        <button className={paymentMethod === "wechat" ? "active" : ""} onClick={() => onPaymentMethodChange("wechat")}>微信</button>
      </section>

      {paymentOrder ? (
        <section className="payment-modal">
          <div className="payment-card">
            <img src="/assets/cat-peek.png" alt="" />
            <strong>{paymentOrder.status === "paid" ? "支付完成" : "等待支付"}</strong>
            <span>{paymentOrder.plan.toUpperCase()} · ¥{paymentOrder.amount} · {paymentOrder.status}</span>
            {paymentOrder.qrCodeUrl ? (
              <div className="qr-box"><img src={paymentOrder.qrCodeUrl} alt="payment qr" /></div>
            ) : (
              <div className="qr-box"><QrCode size={44} /></div>
            )}
            {paymentOrder.payUrl ? <a href={paymentOrder.payUrl}>打开支付链接</a> : null}
            <button onClick={onClosePayment}>关闭</button>
          </div>
        </section>
      ) : null}
    </main>
  );
}
