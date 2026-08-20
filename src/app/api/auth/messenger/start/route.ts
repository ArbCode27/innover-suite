import { NextResponse } from "next/server";
import { env } from "@/lib/config/env";
import {
  buildMessengerAuthorizationUrl,
  getMessengerSettingsRedirectUrl,
} from "@/lib/integrations/messenger";
import { createMessengerOAuthState } from "@/lib/integrations/messenger-state";
import { getCurrentMembership, hasOrganizationRole } from "@/lib/organizations/membership";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!env.facebookAppId || !env.facebookAppSecret || !env.facebookRedirectUri) {
    return NextResponse.redirect(getMessengerSettingsRedirectUrl("missing_env"));
  }

  const membership = await getCurrentMembership();
  if (!membership || !hasOrganizationRole(membership, ["owner", "admin"])) {
    return NextResponse.redirect(getMessengerSettingsRedirectUrl("forbidden"));
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(getMessengerSettingsRedirectUrl("auth_required"));
  }

  try {
    const stateToken = await createMessengerOAuthState(membership.organizationId, user.id);
    return NextResponse.redirect(buildMessengerAuthorizationUrl(stateToken));
  } catch (error) {
    console.error("[MSGR_OAUTH] state creation failed", error);
    return NextResponse.redirect(getMessengerSettingsRedirectUrl("state_error"));
  }
}
