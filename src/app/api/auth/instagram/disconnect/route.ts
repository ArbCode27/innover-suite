import { NextResponse } from "next/server";
import { getSettingsRedirectUrl } from "@/lib/integrations/instagram";
import { getCurrentMembership, hasOrganizationRole } from "@/lib/organizations/membership";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const membership = await getCurrentMembership();
  if (!membership || !hasOrganizationRole(membership, ["owner", "admin"])) {
    return NextResponse.redirect(getSettingsRedirectUrl("forbidden"), { status: 303 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: activeConnections, error: fetchError } = await supabase
    .from("instagram_connections")
    .select("instagram_user_id")
    .eq("organization_id", membership.organizationId)
    .is("revoked_at", null);

  if (fetchError) {
    console.error("[IG_OAUTH] fetch active connections failed", fetchError);
    return NextResponse.redirect(getSettingsRedirectUrl("disconnect_failed"), { status: 303 });
  }

  const { error: revokeError } = await supabase
    .from("instagram_connections")
    .update({ revoked_at: new Date().toISOString() })
    .eq("organization_id", membership.organizationId)
    .is("revoked_at", null);

  if (revokeError) {
    console.error("[IG_OAUTH] revoke connection failed", revokeError);
    return NextResponse.redirect(getSettingsRedirectUrl("disconnect_failed"), { status: 303 });
  }

  const ids = (activeConnections || []).map((item) => item.instagram_user_id);
  if (ids.length > 0) {
    const { error: deleteAccountError } = await supabase
      .from("channel_accounts")
      .delete()
      .eq("organization_id", membership.organizationId)
      .eq("channel", "instagram")
      .in("external_account_id", ids);

    if (deleteAccountError) {
      console.error("[IG_OAUTH] unlink channel account failed", deleteAccountError);
    }
  }

  return NextResponse.redirect(getSettingsRedirectUrl("disconnected"), { status: 303 });
}
