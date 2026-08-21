import { randomBytes } from "node:crypto";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

type OAuthStateRow = {
  id: string;
  organization_id: number;
  user_id: string;
  expires_at: string;
  consumed_at: string | null;
};

const EXPIRATION_MINUTES = 10;

export const createGoogleOAuthState = async (organizationId: number, userId: string) => {
  const admin = getSupabaseAdminClient();
  const stateToken = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + EXPIRATION_MINUTES * 60 * 1000).toISOString();

  const { error } = await admin.from("google_oauth_states").insert({
    organization_id: organizationId,
    user_id: userId,
    state_token: stateToken,
    expires_at: expiresAt,
  });

  if (error) {
    throw error;
  }

  return stateToken;
};

export const consumeGoogleOAuthState = async (stateToken: string) => {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("google_oauth_states")
    .select("id, organization_id, user_id, expires_at, consumed_at")
    .eq("state_token", stateToken)
    .maybeSingle<OAuthStateRow>();

  if (error || !data) {
    return null;
  }

  if (data.consumed_at) {
    return null;
  }

  if (new Date(data.expires_at).getTime() < Date.now()) {
    return null;
  }

  const { data: consumed, error: consumeError } = await admin
    .from("google_oauth_states")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", data.id)
    .is("consumed_at", null)
    .select("organization_id, user_id")
    .maybeSingle<{ organization_id: number; user_id: string }>();

  if (consumeError || !consumed) {
    return null;
  }

  return {
    organizationId: consumed.organization_id,
    userId: consumed.user_id,
  };
};
