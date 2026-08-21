import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/config/env";
import {
  getGoogleTokenExpiryDate,
  isInvalidGoogleGrant,
  refreshGoogleAccessToken,
} from "@/lib/integrations/google-calendar";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

type ConnectionRow = {
  id: number;
  refresh_token: string;
};

const TEN_MINUTES_IN_MS = 10 * 60 * 1000;

const hasValidCronSecret = (request: NextRequest) => {
  if (!env.cronSecret) {
    return false;
  }

  const authHeader = request.headers.get("authorization");
  const tokenFromHeader = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : null;
  const tokenFromCustomHeader = request.headers.get("x-cron-secret");
  return tokenFromHeader === env.cronSecret || tokenFromCustomHeader === env.cronSecret;
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!hasValidCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdminClient();
  const threshold = new Date(Date.now() + TEN_MINUTES_IN_MS).toISOString();
  const { data: connections, error } = await admin
    .from("calendar_connections")
    .select("id, refresh_token")
    .eq("provider", "google")
    .is("revoked_at", null)
    .not("refresh_token", "is", null)
    .lt("token_expires_at", threshold);

  if (error) {
    console.error("[GOOGLE_REFRESH] failed to load expiring tokens", error);
    return NextResponse.json({ error: "Failed to load expiring tokens" }, { status: 500 });
  }

  let refreshed = 0;
  let failed = 0;
  let revoked = 0;

  for (const connection of (connections || []) as ConnectionRow[]) {
    const refreshedToken = await refreshGoogleAccessToken(connection.refresh_token);
    if (!refreshedToken.ok) {
      failed += 1;
      console.error("[GOOGLE_REFRESH] token refresh failed", {
        connectionId: connection.id,
        status: refreshedToken.status,
        body: refreshedToken.errorBody,
      });

      if (isInvalidGoogleGrant(refreshedToken.errorBody)) {
        const { error: revokeError } = await admin
          .from("calendar_connections")
          .update({
            revoked_at: new Date().toISOString(),
            access_token: null,
            refresh_token: null,
            token_expires_at: null,
          })
          .eq("id", connection.id);

        if (!revokeError) {
          revoked += 1;
        }
      }

      continue;
    }

    const { error: updateError } = await admin
      .from("calendar_connections")
      .update({
        access_token: refreshedToken.data.access_token,
        refresh_token: refreshedToken.data.refresh_token || connection.refresh_token,
        token_expires_at: getGoogleTokenExpiryDate(refreshedToken.data.expires_in),
      })
      .eq("id", connection.id);

    if (updateError) {
      failed += 1;
      console.error("[GOOGLE_REFRESH] database update failed", {
        connectionId: connection.id,
        error: updateError,
      });
      continue;
    }

    refreshed += 1;
  }

  return NextResponse.json({
    ok: true,
    refreshed,
    failed,
    revoked,
    scanned: connections?.length || 0,
  });
}
