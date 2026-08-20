import { NextRequest, NextResponse } from "next/server";
import {
  exchangeFacebookAuthorizationCode,
  exchangeLongLivedFacebookToken,
  fetchFacebookPages,
  getMessengerSettingsRedirectUrl,
  isMessengerOAuthConfigured,
  subscribePageToMessengerWebhooks,
} from "@/lib/integrations/messenger";
import { consumeMessengerOAuthState } from "@/lib/integrations/messenger-state";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isMessengerOAuthConfigured()) {
    return NextResponse.redirect(getMessengerSettingsRedirectUrl("missing_env"));
  }

  const oauthError = request.nextUrl.searchParams.get("error");
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");

  if (oauthError === "access_denied") {
    return NextResponse.redirect(getMessengerSettingsRedirectUrl("cancelled"));
  }

  if (!code || !state) {
    return NextResponse.redirect(getMessengerSettingsRedirectUrl("invalid_callback"));
  }

  const stateContext = await consumeMessengerOAuthState(state);
  if (!stateContext) {
    return NextResponse.redirect(getMessengerSettingsRedirectUrl("invalid_state"));
  }

  const shortToken = await exchangeFacebookAuthorizationCode(code);
  if (!shortToken.ok) {
    console.error("[MSGR_OAUTH] short token exchange failed", {
      status: shortToken.status,
      body: shortToken.errorBody,
    });
    return NextResponse.redirect(getMessengerSettingsRedirectUrl("token_exchange_failed"));
  }

  const longToken = await exchangeLongLivedFacebookToken(shortToken.data.access_token);
  if (!longToken.ok) {
    console.error("[MSGR_OAUTH] long token exchange failed", {
      status: longToken.status,
      body: longToken.errorBody,
    });
    return NextResponse.redirect(getMessengerSettingsRedirectUrl("long_token_failed"));
  }

  const pages = await fetchFacebookPages(longToken.data.access_token);
  if (!pages.ok) {
    console.error("[MSGR_OAUTH] page fetch failed", {
      status: pages.status,
      body: pages.errorBody,
    });
    return NextResponse.redirect(getMessengerSettingsRedirectUrl("pages_fetch_failed"));
  }

  const connectablePages = pages.data.filter((page) => page.id && page.access_token);
  if (!connectablePages.length) {
    return NextResponse.redirect(getMessengerSettingsRedirectUrl("no_pages"));
  }

  const admin = getSupabaseAdminClient();
  let subscribedCount = 0;

  for (const page of connectablePages) {
    const pageAccessToken = page.access_token;
    if (!pageAccessToken) {
      continue;
    }

    const subscription = await subscribePageToMessengerWebhooks(page.id, pageAccessToken);
    if (!subscription.ok) {
      console.error("[MSGR_OAUTH] page webhook subscription failed", {
        pageId: page.id,
        status: subscription.status,
        body: subscription.errorBody,
      });
      continue;
    }

    subscribedCount += 1;
    const { error: channelAccountError } = await admin.from("channel_accounts").upsert(
      {
        organization_id: stateContext.organizationId,
        channel: "messenger",
        external_account_id: page.id,
        display_name: page.name || "Facebook Page",
        access_token: pageAccessToken,
        connected_by_user_id: stateContext.userId,
        metadata: {
          provider: "facebook",
          tasks: page.tasks ?? [],
          subscribedFields: ["messages", "messaging_postbacks"],
          connectedAt: new Date().toISOString(),
        },
      },
      { onConflict: "channel,external_account_id" },
    );

    if (channelAccountError) {
      console.error("[MSGR_OAUTH] upsert channel account failed", {
        pageId: page.id,
        error: channelAccountError,
      });
      return NextResponse.redirect(getMessengerSettingsRedirectUrl("persist_failed"));
    }
  }

  if (subscribedCount === 0) {
    return NextResponse.redirect(getMessengerSettingsRedirectUrl("subscription_failed"));
  }

  return NextResponse.redirect(getMessengerSettingsRedirectUrl("connected"));
}
