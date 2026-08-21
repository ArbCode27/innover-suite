import { NextResponse } from "next/server";
import { getGoogleSettingsRedirectUrl, revokeGoogleToken } from "@/lib/integrations/google-calendar";
import { getCurrentMembership, hasOrganizationRole } from "@/lib/organizations/membership";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const membership = await getCurrentMembership();
  if (!membership || !hasOrganizationRole(membership, ["owner", "admin"])) {
    return NextResponse.redirect(getGoogleSettingsRedirectUrl("forbidden"), { status: 303 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: connection, error: fetchError } = await supabase
    .from("calendar_connections")
    .select("id, access_token, refresh_token")
    .eq("organization_id", membership.organizationId)
    .eq("provider", "google")
    .is("revoked_at", null)
    .maybeSingle<{ id: number; access_token: string | null; refresh_token: string | null }>();

  if (fetchError) {
    console.error("[GOOGLE_OAUTH] fetch active connection failed", fetchError);
    return NextResponse.redirect(getGoogleSettingsRedirectUrl("disconnect_failed"), { status: 303 });
  }

  if (!connection) {
    return NextResponse.redirect(getGoogleSettingsRedirectUrl("disconnected"), { status: 303 });
  }

  const tokenToRevoke = connection.refresh_token || connection.access_token;
  if (tokenToRevoke) {
    const revoked = await revokeGoogleToken(tokenToRevoke);
    if (!revoked.ok) {
      console.error("[GOOGLE_OAUTH] google revoke failed", {
        status: revoked.status,
        body: revoked.errorBody,
      });
    }
  }

  const { error: revokeError } = await supabase
    .from("calendar_connections")
    .update({
      revoked_at: new Date().toISOString(),
      access_token: null,
      refresh_token: null,
      token_expires_at: null,
    })
    .eq("id", connection.id)
    .eq("organization_id", membership.organizationId);

  if (revokeError) {
    console.error("[GOOGLE_OAUTH] revoke connection failed", revokeError);
    return NextResponse.redirect(getGoogleSettingsRedirectUrl("disconnect_failed"), { status: 303 });
  }

  return NextResponse.redirect(getGoogleSettingsRedirectUrl("disconnected"), { status: 303 });
}
