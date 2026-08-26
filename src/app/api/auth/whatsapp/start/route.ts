import { NextResponse } from "next/server";
import { env } from "@/lib/config/env";
import {
  isWhatsAppEmbeddedSignupConfigured,
  WHATSAPP_GRAPH_VERSION,
} from "@/lib/integrations/whatsapp";
import { createWhatsAppOAuthState } from "@/lib/integrations/whatsapp-state";
import { getCurrentMembership, hasOrganizationRole } from "@/lib/organizations/membership";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const jsonStatus = (status: string, httpStatus: number) =>
  NextResponse.json({ status }, { status: httpStatus });

export async function GET() {
  if (!isWhatsAppEmbeddedSignupConfigured()) {
    return jsonStatus("missing_env", 503);
  }

  const membership = await getCurrentMembership();
  if (!membership || !hasOrganizationRole(membership, ["owner", "admin"])) {
    return jsonStatus("forbidden", 403);
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonStatus("auth_required", 401);
  }

  try {
    const state = await createWhatsAppOAuthState(membership.organizationId, user.id);
    return NextResponse.json({
      status: "ready",
      appId: env.facebookAppId,
      configId: env.whatsappEmbeddedConfigId,
      graphVersion: WHATSAPP_GRAPH_VERSION,
      state,
    });
  } catch (error) {
    console.error("[WA_EMBEDDED] state creation failed", error);
    return jsonStatus("state_error", 500);
  }
}
