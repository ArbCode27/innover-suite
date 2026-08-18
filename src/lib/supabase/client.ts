import { createBrowserClient } from "@supabase/ssr";
import { env } from "@/lib/config/env";

export const createSupabaseBrowserClient = () =>
  createBrowserClient(env.supabaseUrl, env.supabaseAnonKey);
