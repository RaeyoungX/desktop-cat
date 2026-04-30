import { corsHeaders } from "../cors.ts";
import { fail } from "./http.ts";

export function serveJson(handler: (req: Request) => Promise<Response>): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    try {
      return await handler(req);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Internal error";
      const status = message === "Unauthorized" ? 401 : 500;
      console.error("[desktop-function] error", { message });
      return fail(status === 401 ? "UNAUTHORIZED" : "INTERNAL_ERROR", message, status);
    }
  };
}

export function pathAfterFunction(req: Request, functionName: string): string {
  const pathname = new URL(req.url).pathname;
  return pathname.replace(new RegExp(`^/${functionName}(?=/|$)`), "") || "/";
}
