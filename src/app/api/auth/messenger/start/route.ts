import { NextRequest, NextResponse } from "next/server";
import {
  buildMessengerAuthorizationUrl,
  getMessengerSettingsRedirectUrl,
  isMessengerOAuthConfigured,
} from "@/lib/integrations/messenger";
import { rememberOAuthReturnPath } from "@/lib/integrations/oauth-return";
import { createMessengerOAuthState } from "@/lib/integrations/messenger-state";
import { getCurrentMembership, hasOrganizationRole } from "@/lib/organizations/membership";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const next = request.nextUrl.searchParams.get("next");
  await rememberOAuthReturnPath(next);

  if (!isMessengerOAuthConfigured()) {
    return NextResponse.redirect(getMessengerSettingsRedirectUrl("missing_env", next));
  }

  const membership = await getCurrentMembership();
  if (!membership || !hasOrganizationRole(membership, ["owner", "admin"])) {
    return NextResponse.redirect(getMessengerSettingsRedirectUrl("forbidden", next));
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(getMessengerSettingsRedirectUrl("auth_required", next));
  }

  try {
    const stateToken = await createMessengerOAuthState(membership.organizationId, user.id);
    return NextResponse.redirect(buildMessengerAuthorizationUrl(stateToken));
  } catch (error) {
    console.error("[MSGR_OAUTH] state creation failed", error);
    return NextResponse.redirect(getMessengerSettingsRedirectUrl("state_error", next));
  }
}
