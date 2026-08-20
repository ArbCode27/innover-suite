import { NextResponse } from "next/server";
import {
  getMessengerSettingsRedirectUrl,
  unsubscribePageFromMessengerWebhooks,
} from "@/lib/integrations/messenger";
import { getCurrentMembership, hasOrganizationRole } from "@/lib/organizations/membership";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const membership = await getCurrentMembership();
  if (!membership || !hasOrganizationRole(membership, ["owner", "admin"])) {
    return NextResponse.redirect(getMessengerSettingsRedirectUrl("forbidden"), { status: 303 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: activeConnections, error: fetchError } = await supabase
    .from("channel_accounts")
    .select("external_account_id, access_token")
    .eq("organization_id", membership.organizationId)
    .eq("channel", "messenger");

  if (fetchError) {
    console.error("[MSGR_OAUTH] fetch active connections failed", fetchError);
    return NextResponse.redirect(getMessengerSettingsRedirectUrl("disconnect_failed"), { status: 303 });
  }

  for (const connection of activeConnections ?? []) {
    if (!connection.external_account_id || !connection.access_token) {
      continue;
    }

    const result = await unsubscribePageFromMessengerWebhooks(
      connection.external_account_id,
      connection.access_token,
    );
    if (!result.ok) {
      console.error("[MSGR_OAUTH] page unsubscribe failed", {
        pageId: connection.external_account_id,
        status: result.status,
        body: result.errorBody,
      });
    }
  }

  const { error: deleteError } = await supabase
    .from("channel_accounts")
    .delete()
    .eq("organization_id", membership.organizationId)
    .eq("channel", "messenger");

  if (deleteError) {
    console.error("[MSGR_OAUTH] delete channel accounts failed", deleteError);
    return NextResponse.redirect(getMessengerSettingsRedirectUrl("disconnect_failed"), { status: 303 });
  }

  return NextResponse.redirect(getMessengerSettingsRedirectUrl("disconnected"), { status: 303 });
}
