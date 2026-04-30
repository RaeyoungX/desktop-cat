import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { anonClient, ensureUserBootstrap, quotaForUser, activeSubscription, serviceClient, trimText } from "../_shared/desktop/context.ts";
import { clientIp, fail, ok, parseJsonBody } from "../_shared/desktop/http.ts";
import { hitRateLimit } from "../_shared/desktop/rate_limit.ts";
import { serveJson, pathAfterFunction } from "../_shared/desktop/handler.ts";
import { requireAuthenticatedAppUser } from "../_shared/supabase_client.ts";

async function authPayload(userId: string, email: string | undefined, session?: {
  access_token?: string;
  refresh_token?: string;
  expires_at?: number;
}) {
  const client = serviceClient();
  const subscription = await activeSubscription(client, userId);
  const quota = await quotaForUser(client, userId);
  return {
    user_id: userId,
    email,
    access_token: session?.access_token,
    refresh_token: session?.refresh_token,
    expires_at: session?.expires_at,
    plan: subscription.plan,
    quota_remaining_hours: quota.remaining_hours,
  };
}

async function signup(req: Request): Promise<Response> {
  const client = serviceClient();
  const rate = await hitRateLimit(client, `login:ip:${clientIp(req)}`, 10);
  if (rate.limited) return fail("RATE_LIMITED", "请求过频", 429);

  const body = await parseJsonBody(req);
  const email = trimText(body.email, 320).toLowerCase();
  const password = trimText(body.password, 128);
  if (!email || password.length < 6) return fail("BAD_REQUEST", "邮箱或密码格式不正确", 400);

  const { data: created, error: createError } = await client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError || !created.user) return fail("AUTH_FAILED", createError?.message ?? "注册失败", 400);
  await ensureUserBootstrap(client, created.user.id);

  const { data: signed, error: signInError } = await anonClient().auth.signInWithPassword({ email, password });
  if (signInError || !signed.session) return fail("AUTH_FAILED", signInError?.message ?? "注册成功但登录失败", 400);
  return ok(await authPayload(created.user.id, created.user.email ?? email, signed.session));
}

async function signin(req: Request): Promise<Response> {
  const client = serviceClient();
  const rate = await hitRateLimit(client, `login:ip:${clientIp(req)}`, 10);
  if (rate.limited) return fail("RATE_LIMITED", "请求过频", 429);

  const body = await parseJsonBody(req);
  const email = trimText(body.email, 320).toLowerCase();
  const password = trimText(body.password, 128);
  const { data, error } = await anonClient().auth.signInWithPassword({ email, password });
  if (error || !data.user || !data.session) return fail("UNAUTHORIZED", "邮箱或密码错误", 401);
  await ensureUserBootstrap(client, data.user.id);
  return ok(await authPayload(data.user.id, data.user.email ?? email, data.session));
}

async function refresh(req: Request): Promise<Response> {
  const body = await parseJsonBody(req);
  const refreshToken = trimText(body.refresh_token, 4096);
  if (!refreshToken) return fail("BAD_REQUEST", "Missing refresh_token", 400);
  const { data, error } = await anonClient().auth.refreshSession({ refresh_token: refreshToken });
  if (error || !data.session) return fail("UNAUTHORIZED", "登录已过期", 401);
  return ok({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: data.session.expires_at,
  });
}

serve(serveJson(async (req) => {
  const path = pathAfterFunction(req, "auth");
  if (req.method === "POST" && path === "/signup") return signup(req);
  if (req.method === "POST" && path === "/signin") return signin(req);
  if (req.method === "POST" && path === "/refresh") return refresh(req);
  if (req.method === "POST" && path === "/signout") {
    await requireAuthenticatedAppUser(req);
    return ok();
  }
  return fail("NOT_FOUND", "接口不存在", 404);
}));
