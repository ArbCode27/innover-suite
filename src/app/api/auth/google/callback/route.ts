import { NextRequest, NextResponse } from "next/server";
import {
  exchangeGoogleAuthorizationCode,
  fetchGoogleUserInfo,
  fetchPrimaryGoogleCalendarId,
  getGoogleSettingsRedirectUrl,
  getGoogleTokenExpiryDate,
  isGoogleOAuthConfigured,
} from "@/lib/integrations/google-calendar";
import { consumeGoogleOAuthState } from "@/lib/integrations/google-calendar-state";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isGoogleOAuthConfigured()) {
    return NextResponse.redirect(getGoogleSettingsRedirectUrl("missing_env"));
  }

  const oauthError = request.nextUrl.searchParams.get("error");
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");

  if (oauthError === "access_denied") {
    return NextResponse.redirect(getGoogleSettingsRedirectUrl("cancelled"));
  }

  if (!code || !state) {
    return NextResponse.redirect(getGoogleSettingsRedirectUrl("invalid_callback"));
  }

  const stateContext = await consumeGoogleOAuthState(state);
  if (!stateContext) {
    return NextResponse.redirect(getGoogleSettingsRedirectUrl("invalid_state"));
  }

  const token = await exchangeGoogleAuthorizationCode(code);
  if (!token.ok) {
    console.error("[GOOGLE_OAUTH] token exchange failed", {
      status: token.status,
      body: token.errorBody,
    });
    return NextResponse.redirect(getGoogleSettingsRedirectUrl("token_exchange_failed"));
  }

  const profile = await fetchGoogleUserInfo(token.data.access_token);
  if (!profile.ok) {
    console.error("[GOOGLE_OAUTH] userinfo failed", {
      status: profile.status,
      body: profile.errorBody,
    });
    return NextResponse.redirect(getGoogleSettingsRedirectUrl("profile_failed"));
  }

  const googleUserId = profile.data.id || profile.data.sub || null;
  const email = profile.data.email || null;
  if (!googleUserId || !email) {
    return NextResponse.redirect(getGoogleSettingsRedirectUrl("profile_failed"));
  }

  const googleCalendarId = await fetchPrimaryGoogleCalendarId(token.data.access_token);
  const admin = getSupabaseAdminClient();
  const tokenExpiresAt = getGoogleTokenExpiryDate(token.data.expires_in);

  const { data: existing } = await admin
    .from("calendar_connections")
    .select("id, refresh_token")
    .eq("organization_id", stateContext.organizationId)
    .eq("provider", "google")
    .maybeSingle<{ id: number; refresh_token: string | null }>();

  const refreshToken = token.data.refresh_token || existing?.refresh_token || null;
  if (!refreshToken) {
    return NextResponse.redirect(getGoogleSettingsRedirectUrl("missing_refresh_token"));
  }

  const payload = {
    organization_id: stateContext.organizationId,
    provider: "google",
    email,
    google_user_id: googleUserId,
    google_calendar_id: googleCalendarId,
    access_token: token.data.access_token,
    refresh_token: refreshToken,
    token_expires_at: tokenExpiresAt,
    connected_by_user_id: stateContext.userId,
    connected_at: new Date().toISOString(),
    revoked_at: null,
  };

  const persist = existing?.id
    ? await admin.from("calendar_connections").update(payload).eq("id", existing.id)
    : await admin.from("calendar_connections").insert(payload);

  if (persist.error) {
    console.error("[GOOGLE_OAUTH] persist calendar_connections failed", persist.error);
    return NextResponse.redirect(getGoogleSettingsRedirectUrl("persist_failed"));
  }

  return NextResponse.redirect(getGoogleSettingsRedirectUrl("connected"));
}
