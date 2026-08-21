import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/config/env";
import { syncInstagramTokenToOrganizationAccounts } from "@/lib/integrations/instagram-credentials";
import { getExpiryDate, refreshLongLivedToken } from "@/lib/integrations/instagram";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

type ConnectionRow = {
  id: number;
  organization_id: number;
  instagram_user_id: string;
  access_token: string;
};

const TEN_DAYS_IN_MS = 10 * 24 * 60 * 60 * 1000;

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
  const threshold = new Date(Date.now() + TEN_DAYS_IN_MS).toISOString();
  const { data: connections, error } = await admin
    .from("instagram_connections")
    .select("id, organization_id, instagram_user_id, access_token")
    .is("revoked_at", null)
    .lt("token_expires_at", threshold);

  if (error) {
    console.error("[IG_REFRESH] failed to load expiring tokens", error);
    return NextResponse.json({ error: "Failed to load expiring tokens" }, { status: 500 });
  }

  let refreshed = 0;
  let failed = 0;
  for (const connection of (connections || []) as ConnectionRow[]) {
    const refreshedToken = await refreshLongLivedToken(connection.access_token);
    if (!refreshedToken.ok) {
      failed += 1;
      console.error("[IG_REFRESH] token refresh failed", {
        connectionId: connection.id,
        status: refreshedToken.status,
        body: refreshedToken.errorBody,
      });
      continue;
    }

    const tokenExpiresAt = getExpiryDate(refreshedToken.data.expires_in);
    const { error: updateError } = await admin
      .from("instagram_connections")
      .update({
        access_token: refreshedToken.data.access_token,
        token_expires_at: tokenExpiresAt,
      })
      .eq("id", connection.id);

    if (updateError) {
      failed += 1;
      console.error("[IG_REFRESH] database update failed", {
        connectionId: connection.id,
        error: updateError,
      });
      continue;
    }

    await syncInstagramTokenToOrganizationAccounts(admin, connection.organization_id, {
      accessToken: refreshedToken.data.access_token,
      oauthInstagramUserId: connection.instagram_user_id,
      tokenExpiresAt,
    });

    refreshed += 1;
  }

  return NextResponse.json({
    ok: true,
    refreshed,
    failed,
    scanned: connections?.length || 0,
  });
}
