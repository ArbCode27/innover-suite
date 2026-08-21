import { NextResponse } from "next/server";
import {
  buildGoogleAuthorizationUrl,
  getGoogleSettingsRedirectUrl,
  isGoogleOAuthConfigured,
} from "@/lib/integrations/google-calendar";
import { createGoogleOAuthState } from "@/lib/integrations/google-calendar-state";
import { getCurrentMembership, hasOrganizationRole } from "@/lib/organizations/membership";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!isGoogleOAuthConfigured()) {
    return NextResponse.redirect(getGoogleSettingsRedirectUrl("missing_env"));
  }

  const membership = await getCurrentMembership();
  if (!membership || !hasOrganizationRole(membership, ["owner", "admin"])) {
    return NextResponse.redirect(getGoogleSettingsRedirectUrl("forbidden"));
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(getGoogleSettingsRedirectUrl("auth_required"));
  }

  try {
    const stateToken = await createGoogleOAuthState(membership.organizationId, user.id);
    return NextResponse.redirect(buildGoogleAuthorizationUrl(stateToken));
  } catch (error) {
    console.error("[GOOGLE_OAUTH] state creation failed", error);
    return NextResponse.redirect(getGoogleSettingsRedirectUrl("state_error"));
  }
}
