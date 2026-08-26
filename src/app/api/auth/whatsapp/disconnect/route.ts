import { NextResponse } from "next/server";
import {
  getWhatsAppSettingsRedirectUrl,
  parseWhatsAppAccountMetadata,
  unsubscribeWabaFromAppWebhooks,
} from "@/lib/integrations/whatsapp";
import { getCurrentMembership, hasOrganizationRole } from "@/lib/organizations/membership";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const membership = await getCurrentMembership();
  if (!membership || !hasOrganizationRole(membership, ["owner", "admin"])) {
    return NextResponse.redirect(getWhatsAppSettingsRedirectUrl("forbidden"), { status: 303 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: activeConnections, error: fetchError } = await supabase
    .from("channel_accounts")
    .select("external_account_id, access_token, metadata")
    .eq("organization_id", membership.organizationId)
    .eq("channel", "whatsapp");

  if (fetchError) {
    console.error("[WA_EMBEDDED] fetch active connections failed", fetchError);
    return NextResponse.redirect(getWhatsAppSettingsRedirectUrl("disconnect_failed"), { status: 303 });
  }

  const unsubscribed = new Set<string>();
  for (const connection of activeConnections ?? []) {
    const metadata = parseWhatsAppAccountMetadata(connection.metadata);
    const wabaId = metadata.wabaId;
    const accessToken = connection.access_token as string | null;
    if (!wabaId || !accessToken || unsubscribed.has(wabaId)) {
      continue;
    }

    unsubscribed.add(wabaId);
    const result = await unsubscribeWabaFromAppWebhooks(wabaId, accessToken);
    if (!result.ok) {
      console.error("[WA_EMBEDDED] waba unsubscribe failed", {
        wabaId,
        status: result.status,
        body: result.errorBody,
      });
    }
  }

  const { error: deleteError } = await supabase
    .from("channel_accounts")
    .delete()
    .eq("organization_id", membership.organizationId)
    .eq("channel", "whatsapp");

  if (deleteError) {
    console.error("[WA_EMBEDDED] delete channel accounts failed", deleteError);
    return NextResponse.redirect(getWhatsAppSettingsRedirectUrl("disconnect_failed"), { status: 303 });
  }

  return NextResponse.redirect(getWhatsAppSettingsRedirectUrl("disconnected"), { status: 303 });
}
