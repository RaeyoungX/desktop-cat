import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { inventoryForUser, requireAuthAndRateLimit, serviceClient, statsForUser, trimText } from "../_shared/desktop/context.ts";
import { fail, ok, parseJsonBody } from "../_shared/desktop/http.ts";
import { serveJson, pathAfterFunction } from "../_shared/desktop/handler.ts";

async function items(): Promise<Response> {
  const { data, error } = await serviceClient()
    .from("shop_items")
    .select("id,name,icon,icon_color,icon_bg,cost,description,available,sort_order")
    .order("sort_order", { ascending: true });
  if (error) return fail("INTERNAL_ERROR", error.message, 500);
  return ok({
    items: (data ?? []).map((item: Record<string, unknown>) => ({
      id: item.id,
      name: item.name,
      icon: item.icon,
      icon_color: item.icon_color,
      icon_bg: item.icon_bg,
      cost: item.cost,
      desc: item.description,
      available: item.available,
    })),
  });
}

serve(serveJson(async (req) => {
  const path = pathAfterFunction(req, "shop");
  if (req.method === "GET" && path === "/items") return items();

  const auth = await requireAuthAndRateLimit(req);
  if (auth instanceof Response) return auth;

  if (req.method === "GET" && path === "/inventory") {
    return ok(await inventoryForUser(auth.serviceClient, auth.publicUserId));
  }

  if (req.method === "POST" && path === "/buy") {
    const body = await parseJsonBody(req);
    const itemId = trimText(body.item_id, 80);
    const { data: item } = await auth.serviceClient
      .from("shop_items")
      .select("id,cost,available")
      .eq("id", itemId)
      .maybeSingle();
    if (!item || !item.available) return fail("NOT_FOUND", "商品不存在", 404);

    const inventory = await inventoryForUser(auth.serviceClient, auth.publicUserId);
    if (inventory.owned.includes(itemId)) {
      return ok({ item_id: itemId, points_spent: 0, points_remaining: (await statsForUser(auth.serviceClient, auth.publicUserId)).points, owned: inventory.owned });
    }

    const stats = await statsForUser(auth.serviceClient, auth.publicUserId);
    const cost = Number(item.cost ?? 0);
    if (stats.points < cost) return fail("INSUFFICIENT_POINTS", `积分不足，需要 ${cost} 分，当前 ${stats.points} 分`, 400);

    const pointsRemaining = stats.points - cost;
    await auth.serviceClient.from("user_stats").update({
      points: pointsRemaining,
      updated_at: new Date().toISOString(),
    }).eq("user_id", auth.publicUserId);
    await auth.serviceClient.from("inventory").insert({ user_id: auth.publicUserId, item_id: itemId });
    const next = await inventoryForUser(auth.serviceClient, auth.publicUserId);
    return ok({ item_id: itemId, points_spent: cost, points_remaining: pointsRemaining, owned: next.owned });
  }

  if (req.method === "POST" && path === "/equip") {
    const body = await parseJsonBody(req);
    const itemId = trimText(body.item_id, 80);
    const action = body.action === "unequip" ? "unequip" : "equip";
    const inventory = await inventoryForUser(auth.serviceClient, auth.publicUserId);
    if (!inventory.owned.includes(itemId)) return fail("FORBIDDEN", "尚未拥有该道具", 403);
    const equipped = new Set(inventory.equipped);
    if (action === "equip") equipped.add(itemId);
    else equipped.delete(itemId);
    const next = [...equipped];
    await auth.serviceClient.from("equipped_items").upsert({
      user_id: auth.publicUserId,
      item_ids: next,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    return ok({ equipped: next });
  }

  return fail("NOT_FOUND", "接口不存在", 404);
}));
