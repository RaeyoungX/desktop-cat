import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { ensureUserBootstrap, isoFromInput, requireAuthAndRateLimit, statsForUser, trimText } from "../_shared/desktop/context.ts";
import { fail, ok, parseJsonBody } from "../_shared/desktop/http.ts";
import { serveJson, pathAfterFunction } from "../_shared/desktop/handler.ts";
import { sessionAwardMinutes } from "../_shared/desktop/plans.ts";

type SessionSyncItem = {
  local_id?: string;
  localId?: string;
  name?: string;
  duration?: number;
  plannedMinutes?: number;
  actual_seconds?: number;
  actualSeconds?: number;
  start_time?: string;
  startTime?: number;
  end_time?: string;
  endTime?: number;
  distract_count?: number;
  distractCount?: number;
};

function normalizeSession(item: SessionSyncItem) {
  const localId = trimText(item.local_id ?? item.localId, 120);
  const name = trimText(item.name, 160) || "专注任务";
  const plannedMinutes = Math.max(0, Math.min(480, Math.round(Number(item.duration ?? item.plannedMinutes ?? 0) || 0)));
  const actualSeconds = Math.max(0, Math.round(Number(item.actual_seconds ?? item.actualSeconds ?? plannedMinutes * 60) || 0));
  const startTime = isoFromInput(item.start_time ?? item.startTime);
  const endTime = item.end_time || item.endTime ? isoFromInput(item.end_time ?? item.endTime) : null;
  const distractCount = Math.max(0, Math.round(Number(item.distract_count ?? item.distractCount ?? 0) || 0));
  return { localId, name, plannedMinutes, actualSeconds, startTime, endTime, distractCount };
}

serve(serveJson(async (req) => {
  const path = pathAfterFunction(req, "sessions");
  if (req.method !== "POST" || path !== "/sync") return fail("NOT_FOUND", "接口不存在", 404);
  const auth = await requireAuthAndRateLimit(req);
  if (auth instanceof Response) return auth;

  await ensureUserBootstrap(auth.serviceClient, auth.publicUserId);
  const body = await parseJsonBody<{ sessions?: SessionSyncItem[] }>(req);
  const incoming = Array.isArray(body.sessions) ? body.sessions.map(normalizeSession).filter((item) => item.localId) : [];
  if (incoming.length === 0) {
    const stats = await statsForUser(auth.serviceClient, auth.publicUserId);
    return ok({ synced: 0, points_awarded: 0, total_points: stats.points });
  }

  const localIds = incoming.map((item) => item.localId);
  const { data: existing } = await auth.serviceClient
    .from("sessions")
    .select("local_id")
    .eq("user_id", auth.publicUserId)
    .in("local_id", localIds);
  const existingIds = new Set((existing ?? []).map((row: { local_id?: string }) => row.local_id));
  const fresh = incoming.filter((item) => !existingIds.has(item.localId));

  if (fresh.length > 0) {
    await auth.serviceClient.from("sessions").insert(fresh.map((item) => ({
      user_id: auth.publicUserId,
      local_id: item.localId,
      name: item.name,
      duration: sessionAwardMinutes(item.actualSeconds, item.plannedMinutes),
      start_time: item.startTime,
      end_time: item.endTime,
      distract_count: item.distractCount,
    })));
  }

  const pointsAwarded = fresh.reduce((sum, item) => sum + sessionAwardMinutes(item.actualSeconds, item.plannedMinutes), 0);
  const current = await statsForUser(auth.serviceClient, auth.publicUserId);
  const next = {
    points: current.points + pointsAwarded,
    total_sessions: current.total_sessions + fresh.length,
    total_mins: current.total_mins + pointsAwarded,
    updated_at: new Date().toISOString(),
  };
  await auth.serviceClient.from("user_stats").upsert({
    user_id: auth.publicUserId,
    ...next,
  }, { onConflict: "user_id" });

  return ok({ synced: fresh.length, points_awarded: pointsAwarded, total_points: next.points });
}));
