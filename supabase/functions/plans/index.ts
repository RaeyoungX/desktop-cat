import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { ok } from "../_shared/desktop/http.ts";
import { serveJson } from "../_shared/desktop/handler.ts";
import { PLANS } from "../_shared/desktop/plans.ts";

serve(serveJson(async () => ok({ plans: PLANS })));
