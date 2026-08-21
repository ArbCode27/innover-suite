import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  getGoogleTokenExpiryDate,
  isInvalidGoogleGrant,
  refreshGoogleAccessToken,
} from "@/lib/integrations/google-calendar";

type CalendarConnectionRow = {
  id: number;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
};

const TOKEN_REFRESH_BUFFER_MS = 60 * 1000;

export const getOrganizationGoogleAccessToken = async (organizationId: number) => {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("calendar_connections")
    .select("id, access_token, refresh_token, token_expires_at")
    .eq("organization_id", organizationId)
    .eq("provider", "google")
    .is("revoked_at", null)
    .maybeSingle<CalendarConnectionRow>();

  if (error || !data?.refresh_token) {
    return null;
  }

  const expiresAt = data.token_expires_at ? new Date(data.token_expires_at).getTime() : 0;
  if (data.access_token && expiresAt > Date.now() + TOKEN_REFRESH_BUFFER_MS) {
    return data.access_token;
  }

  const refreshed = await refreshGoogleAccessToken(data.refresh_token);
  if (!refreshed.ok) {
    if (isInvalidGoogleGrant(refreshed.errorBody)) {
      await admin
        .from("calendar_connections")
        .update({
          revoked_at: new Date().toISOString(),
          access_token: null,
          refresh_token: null,
        })
        .eq("id", data.id);
    }

    console.error("[GOOGLE_CALENDAR] token refresh failed", {
      connectionId: data.id,
      status: refreshed.status,
      body: refreshed.errorBody,
    });
    return null;
  }

  const tokenExpiresAt = getGoogleTokenExpiryDate(refreshed.data.expires_in);
  const nextRefreshToken = refreshed.data.refresh_token || data.refresh_token;
  const { error: updateError } = await admin
    .from("calendar_connections")
    .update({
      access_token: refreshed.data.access_token,
      refresh_token: nextRefreshToken,
      token_expires_at: tokenExpiresAt,
    })
    .eq("id", data.id);

  if (updateError) {
    console.error("[GOOGLE_CALENDAR] failed to persist refreshed token", updateError);
    return refreshed.data.access_token;
  }

  return refreshed.data.access_token;
};
