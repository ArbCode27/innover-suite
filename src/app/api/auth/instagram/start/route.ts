import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/config/env";
import {
  buildInstagramAuthorizationUrl,
  getSettingsRedirectUrl,
} from "@/lib/integrations/instagram";
import { rememberOAuthReturnPath } from "@/lib/integrations/oauth-return";
import { createInstagramOAuthState } from "@/lib/integrations/instagram-state";
import { getCurrentMembership, hasOrganizationRole } from "@/lib/organizations/membership";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const next = request.nextUrl.searchParams.get("next");
  await rememberOAuthReturnPath(next);

  if (!env.instagramAppId || !env.instagramAppSecret || !env.instagramRedirectUri) {
    return NextResponse.redirect(getSettingsRedirectUrl("missing_env", next));
  }

  const membership = await getCurrentMembership();
  if (!membership || !hasOrganizationRole(membership, ["owner", "admin"])) {
    return NextResponse.redirect(getSettingsRedirectUrl("forbidden", next));
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(getSettingsRedirectUrl("auth_required", next));
  }

  try {
    const stateToken = await createInstagramOAuthState(membership.organizationId, user.id);
    return NextResponse.redirect(buildInstagramAuthorizationUrl(stateToken));
  } catch (error) {
    console.error("[IG_OAUTH] state creation failed", error);
    return NextResponse.redirect(getSettingsRedirectUrl("state_error", next));
  }
}
