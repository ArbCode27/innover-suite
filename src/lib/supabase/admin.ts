import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/config/env";

export const getSupabaseAdminClient = () => {
  if (!env.supabaseServiceKey) {
    throw new Error("Missing env var: SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(env.supabaseUrl, env.supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};
