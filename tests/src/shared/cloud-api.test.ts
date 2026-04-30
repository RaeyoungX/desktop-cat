import { describe, expect, it, vi } from "vitest";
import { cloudApiRequest } from "../../../src/shared/cloud-api";

describe("renderer cloud api", () => {
  it("fetches cloud endpoints from the renderer with bearer auth", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      ok: true,
      data: { order_id: "CAT20260430abc" },
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await cloudApiRequest("/payment/create", {
      method: "POST",
      auth: true,
      body: { plan_id: "pro" },
      getApiBase: async () => "https://example.supabase.co/functions/v1",
      getAuthSession: async () => ({ access_token: "token-123" }),
    });

    expect(result).toEqual({ ok: true, data: { order_id: "CAT20260430abc" } });
    expect(fetchMock).toHaveBeenCalledWith("https://example.supabase.co/functions/v1/payment/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer token-123",
      },
      body: JSON.stringify({ plan_id: "pro" }),
    });
  });
});
