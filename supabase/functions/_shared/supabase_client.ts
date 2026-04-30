import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.105.0";

type AuthenticatedAppUser = {
  authUser: { id: string; email?: string };
  publicUserId: string;
  serviceClient: SupabaseClient;
};

function getSupabaseConfig() {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !serviceRole || !anon) throw new Error("Missing Supabase function secrets");
  return { url, serviceRole, anon };
}

export async function requireAuthenticatedAppUser(req: Request): Promise<AuthenticatedAppUser> {
  const { url, serviceRole, anon } = getSupabaseConfig();
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new Error("Unauthorized");

  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: authHeader } },
  });
  const serviceClient = createClient(url, serviceRole);
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) throw new Error("Unauthorized");

  return {
    authUser: {
      id: data.user.id,
      email: data.user.email ?? undefined,
    },
    publicUserId: data.user.id,
    serviceClient,
  };
}
