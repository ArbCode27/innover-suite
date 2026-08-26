import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  exchangeWhatsAppAuthorizationCode,
  isWhatsAppEmbeddedSignupConfigured,
  resolveAccessToken,
  resolveWhatsAppPhoneNumbers,
  subscribeWabaToAppWebhooks,
} from "@/lib/integrations/whatsapp";
import { consumeWhatsAppOAuthState } from "@/lib/integrations/whatsapp-state";
import { getCurrentMembership, hasOrganizationRole } from "@/lib/organizations/membership";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const callbackSchema = z.object({
  code: z.string().trim().min(1),
  state: z.string().trim().min(1),
  wabaId: z.string().trim().min(1).optional(),
  phoneNumberId: z.string().trim().min(1).optional(),
  businessId: z.string().trim().min(1).optional(),
});

const jsonStatus = (status: string, httpStatus: number) =>
  NextResponse.json({ status }, { status: httpStatus });

export async function POST(request: NextRequest) {
  if (!isWhatsAppEmbeddedSignupConfigured()) {
    return jsonStatus("missing_env", 503);
  }

  const membership = await getCurrentMembership();
  if (!membership || !hasOrganizationRole(membership, ["owner", "admin"])) {
    return jsonStatus("forbidden", 403);
  }

  const parsed = callbackSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonStatus("invalid_callback", 400);
  }

  const stateContext = await consumeWhatsAppOAuthState(parsed.data.state);
  if (!stateContext) {
    return jsonStatus("invalid_state", 400);
  }

  if (stateContext.organizationId !== membership.organizationId) {
    return jsonStatus("forbidden", 403);
  }

  const shortToken = await exchangeWhatsAppAuthorizationCode(parsed.data.code);
  if (!shortToken.ok) {
    console.error("[WA_EMBEDDED] code exchange failed", {
      status: shortToken.status,
      body: shortToken.errorBody,
    });
    return jsonStatus("token_exchange_failed", 502);
  }

  const accessToken = await resolveAccessToken(shortToken.data.access_token);
  const numbers = await resolveWhatsAppPhoneNumbers(
    {
      wabaId: parsed.data.wabaId,
      phoneNumberId: parsed.data.phoneNumberId,
      businessId: parsed.data.businessId,
    },
    accessToken,
  );

  if (!numbers.ok) {
    console.error("[WA_EMBEDDED] phone discovery failed", {
      status: numbers.status,
      body: numbers.errorBody,
    });
    return jsonStatus("no_numbers", 422);
  }

  const admin = getSupabaseAdminClient();
  const connectedAt = new Date().toISOString();
  let persistedCount = 0;

  for (const phone of numbers.data.phones) {
    const wabaId = numbers.data.wabaIdByPhoneId.get(phone.id) ?? parsed.data.wabaId ?? null;
    const displayName = phone.verifiedName || phone.displayPhoneNumber || "WhatsApp";
    const { error: channelAccountError } = await admin.from("channel_accounts").upsert(
      {
        organization_id: stateContext.organizationId,
        channel: "whatsapp",
        external_account_id: phone.id,
        display_name: displayName,
        access_token: accessToken,
        connected_by_user_id: stateContext.userId,
        metadata: {
          provider: "whatsapp_embedded_signup",
          wabaId,
          businessId: parsed.data.businessId ?? null,
          displayPhoneNumber: phone.displayPhoneNumber,
          verifiedName: phone.verifiedName,
          qualityRating: phone.qualityRating,
          connectedAt,
        },
      },
      { onConflict: "channel,external_account_id" },
    );

    if (channelAccountError) {
      console.error("[WA_EMBEDDED] upsert channel account failed", {
        phoneNumberId: phone.id,
        error: channelAccountError,
      });
      continue;
    }

    persistedCount += 1;
  }

  if (persistedCount === 0) {
    return jsonStatus("persist_failed", 500);
  }

  const uniqueWabaIds = [...new Set(numbers.data.wabaIds.filter(Boolean))];
  let subscribedCount = 0;
  for (const wabaId of uniqueWabaIds) {
    const subscription = await subscribeWabaToAppWebhooks(wabaId, accessToken);
    if (!subscription.ok) {
      console.error("[WA_EMBEDDED] waba webhook subscription failed", {
        wabaId,
        status: subscription.status,
        body: subscription.errorBody,
      });
      continue;
    }
    subscribedCount += 1;
  }

  if (uniqueWabaIds.length > 0 && subscribedCount === 0) {
    return jsonStatus("subscription_failed", 502);
  }

  return NextResponse.json({ status: "connected" });
}
