import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { ensureUserBootstrap, requireAuthAndRateLimit, statsForUser } from "../_shared/desktop/context.ts";
import { fail, ok, parseJsonBody } from "../_shared/desktop/http.ts";
import { serveJson, pathAfterFunction } from "../_shared/desktop/handler.ts";

function parseLimit(req: Request): number {
  const url = new URL(req.url);
  const limit = Number(url.searchParams.get("limit") ?? 10);
  return Math.max(1, Math.min(50, Number.isFinite(limit) ? Math.round(limit) : 10));
}

serve(serveJson(async (req) => {
  const path = pathAfterFunction(req, "stats");
  const auth = await requireAuthAndRateLimit(req);
  if (auth instanceof Response) return auth;
  await ensureUserBootstrap(auth.serviceClient, auth.publicUserId);

  if (req.method === "POST" && path === "/sync") {
    const body = await parseJsonBody(req);
    const current = await statsForUser(auth.serviceClient, auth.publicUserId);
    const next = {
      points: Math.max(current.points, Math.round(Number(body.points ?? 0) || 0)),
      total_sessions: Math.max(current.total_sessions, Math.round(Number(body.total_sessions ?? 0) || 0)),
      total_mins: Math.max(current.total_mins, Math.round(Number(body.total_mins ?? 0) || 0)),
      updated_at: new Date().toISOString(),
    };
    await auth.serviceClient.from("user_stats").upsert({
      user_id: auth.publicUserId,
      ...next,
    }, { onConflict: "user_id" });
    return ok(next);
  }

  if (req.method === "GET" && path === "/leaderboard") {
    const limit = parseLimit(req);
    const { data } = await auth.serviceClient
      .from("user_stats")
      .select("user_id,points,total_mins,total_sessions")
      .order("points", { ascending: false })
      .order("total_mins", { ascending: false })
      .limit(Math.max(100, limit));
    const rows = data ?? [];
    const leaderboard = rows.slice(0, limit).map((row: {
      user_id: string;
      points: number;
      total_mins: number;
      total_sessions: number;
    }, index: number) => ({
      rank: index + 1,
      user_id: row.user_id,
      points: row.points,
      total_mins: row.total_mins,
      total_sessions: row.total_sessions,
    }));
    const rankIndex = rows.findIndex((row: { user_id: string }) => row.user_id === auth.publicUserId);
    return ok({ rank: rankIndex >= 0 ? rankIndex + 1 : null, leaderboard });
  }

  return fail("NOT_FOUND", "接口不存在", 404);
}));
