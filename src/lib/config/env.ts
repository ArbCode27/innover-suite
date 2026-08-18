const required = (value: string | undefined, key: string): string => {
  if (!value || !value.trim()) {
    throw new Error(`Missing env var: ${key}`);
  }
  return value.trim();
};

export const env = {
  supabaseUrl: required(process.env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: required(
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  ),
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "",
  geminiApiKey: process.env.GEMINI_API_KEY?.trim() || "",
  metaAccessToken: process.env.META_ACCESS_TOKEN?.trim() || "",
  metaWebhookVerifyToken: process.env.META_WEBHOOK_VERIFY_TOKEN?.trim() || "",
  googleClientId: process.env.GOOGLE_CLIENT_ID?.trim() || "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET?.trim() || "",
};
