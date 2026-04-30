import { corsHeaders } from "../cors.ts";

export type ApiErrorBody = {
  ok: false;
  error: {
    code: string;
    message: string;
    data?: unknown;
  };
};

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function ok(data: unknown = {}, status = 200): Response {
  return jsonResponse({ ok: true, data }, status);
}

export function fail(code: string, message: string, status = 400, data?: unknown): Response {
  const body: ApiErrorBody = {
    ok: false,
    error: data === undefined ? { code, message } : { code, message, data },
  };
  return jsonResponse(body, status);
}

export async function parseJsonBody<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    const parsed = await req.json();
    return parsed && typeof parsed === "object" ? parsed as T : {} as T;
  } catch {
    return {} as T;
  }
}

export async function parseFormBody(req: Request): Promise<Record<string, string>> {
  const text = await req.text();
  const params = new URLSearchParams(text);
  const out: Record<string, string> = {};
  for (const [key, value] of params.entries()) out[key] = value;
  return out;
}

export function clientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("cf-connecting-ip")
    || req.headers.get("x-real-ip")
    || "0.0.0.0"
  );
}

export function functionRoute(req: Request, functionName: string): string {
  const pathname = new URL(req.url).pathname;
  const stripped = pathname.replace(new RegExp(`^/${functionName}(?=/|$)`), "");
  return stripped || "/";
}
