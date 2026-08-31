import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/config/env";
import { syncInstagramTokenToOrganizationAccounts } from "@/lib/integrations/instagram-credentials";
import {
  exchangeAuthorizationCode,
  exchangeLongLivedToken,
  fetchInstagramProfile,
  getExpiryDate,
  getSettingsRedirectUrl,
} from "@/lib/integrations/instagram";
import { consumeOAuthReturnPath } from "@/lib/integrations/oauth-return";
import { consumeInstagramOAuthState } from "@/lib/integrations/instagram-state";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const returnPath = await consumeOAuthReturnPath();

  if (!env.instagramAppId || !env.instagramAppSecret || !env.instagramRedirectUri) {
    return NextResponse.redirect(getSettingsRedirectUrl("missing_env", returnPath));
  }

  const oauthError = request.nextUrl.searchParams.get("error");
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");

  if (oauthError === "access_denied") {
    return NextResponse.redirect(getSettingsRedirectUrl("cancelled", returnPath));
  }

  if (!code || !state) {
    return NextResponse.redirect(getSettingsRedirectUrl("invalid_callback", returnPath));
  }

  const stateContext = await consumeInstagramOAuthState(state);
  if (!stateContext) {
    return NextResponse.redirect(getSettingsRedirectUrl("invalid_state", returnPath));
  }

  const shortToken = await exchangeAuthorizationCode(code);
  if (!shortToken.ok) {
    console.error("[IG_OAUTH] short token exchange failed", {
      status: shortToken.status,
      body: shortToken.errorBody,
    });
    return NextResponse.redirect(getSettingsRedirectUrl("token_exchange_failed", returnPath));
  }

  const longToken = await exchangeLongLivedToken(shortToken.data.access_token);
  if (!longToken.ok) {
    console.error("[IG_OAUTH] long token exchange failed", {
      status: longToken.status,
      body: longToken.errorBody,
    });
    return NextResponse.redirect(getSettingsRedirectUrl("long_token_failed", returnPath));
  }

  const profile = await fetchInstagramProfile(longToken.data.access_token);
  if (!profile.ok) {
    console.error("[IG_OAUTH] profile fetch failed", {
      status: profile.status,
      body: profile.errorBody,
    });
  }

  const instagramUserId = profile.ok ? profile.data.id : shortToken.data.user_id;
  const instagramUsername = profile.ok ? profile.data.username || null : null;
  const admin = getSupabaseAdminClient();
  const tokenExpiresAt = getExpiryDate(longToken.data.expires_in);

  const { error: connectionError } = await admin.from("instagram_connections").upsert(
    {
      organization_id: stateContext.organizationId,
      instagram_user_id: instagramUserId,
      instagram_username: instagramUsername,
      access_token: longToken.data.access_token,
      token_expires_at: tokenExpiresAt,
      connected_by_user_id: stateContext.userId,
      connected_at: new Date().toISOString(),
      revoked_at: null,
    },
    { onConflict: "organization_id,instagram_user_id" },
  );

  if (connectionError) {
    console.error("[IG_OAUTH] upsert instagram_connections failed", connectionError);
    return NextResponse.redirect(getSettingsRedirectUrl("persist_failed", returnPath));
  }

  const { error: channelAccountError } = await admin.from("channel_accounts").upsert(
    {
      organization_id: stateContext.organizationId,
      channel: "instagram",
      external_account_id: instagramUserId,
      display_name: instagramUsername || "Instagram",
      access_token: longToken.data.access_token,
      connected_by_user_id: stateContext.userId,
      metadata: {
        provider: "instagram",
        token_expires_at: tokenExpiresAt,
        connectedAt: new Date().toISOString(),
      },
    },
    { onConflict: "channel,external_account_id" },
  );

  if (channelAccountError) {
    console.error("[IG_OAUTH] upsert channel_accounts failed", channelAccountError);
    return NextResponse.redirect(getSettingsRedirectUrl("persist_failed", returnPath));
  }

  await syncInstagramTokenToOrganizationAccounts(admin, stateContext.organizationId, {
    accessToken: longToken.data.access_token,
    oauthInstagramUserId: instagramUserId,
    tokenExpiresAt,
  });

  return NextResponse.redirect(getSettingsRedirectUrl("connected", returnPath));
}
