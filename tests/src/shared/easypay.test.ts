import { describe, expect, it } from "vitest";
import {
  buildEasyPaySignSource,
  mapPaymentMethod,
  normalizeEasyPayCreateResponse,
  normalizeEasyPayOrderStatus,
} from "../../../src/shared/easypay";

describe("EasyPay helpers", () => {
  it("builds the canonical sign source excluding sign fields and empty values", () => {
    expect(buildEasyPaySignSource({
      money: "148.00",
      sign: "ignored",
      type: "alipay",
      empty: "",
      sign_type: "MD5",
      pid: "1001",
    })).toBe("money=148.00&pid=1001&type=alipay");
  });

  it("maps app payment methods to EasyPay methods", () => {
    expect(mapPaymentMethod("alipay")).toBe("alipay");
    expect(mapPaymentMethod("wechat")).toBe("wxpay");
  });

  it("normalizes create payment response links for in-app polling UI", () => {
    expect(normalizeEasyPayCreateResponse({
      code: 1,
      trade_no: "EP-1",
      payurl: "https://pay.example/pay",
      qrcode: "https://pay.example/qr.png",
    })).toEqual({
      tradeNo: "EP-1",
      payUrl: "https://pay.example/pay",
      qrCodeUrl: "https://pay.example/qr.png",
    });
  });

  it("normalizes EasyPay query status", () => {
    expect(normalizeEasyPayOrderStatus(1)).toBe("paid");
    expect(normalizeEasyPayOrderStatus(0)).toBe("pending");
  });
});
