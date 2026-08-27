import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  completeWhatsAppEmbeddedSignup,
  getWhatsAppSettingsRedirectUrl,
  isSafeWhatsAppOAuthReturnPath,
  isWhatsAppEmbeddedSignupConfigured,
  isWhatsAppOAuthConfigured,
} from "@/lib/integrations/whatsapp";
import { consumeWhatsAppOAuthState } from "@/lib/integrations/whatsapp-state";
import { getCurrentMembership, hasOrganizationRole } from "@/lib/organizations/membership";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

const redirectToSettings = (status: string) =>
  NextResponse.redirect(getWhatsAppSettingsRedirectUrl(status));

const readQueryValue = (search: URLSearchParams, keys: string[]) => {
  for (const key of keys) {
    const value = search.get(key)?.trim();
    if (value) return value;
  }
  return undefined;
};

const resolveConnectActor = async (stateToken?: string) => {
  const stateContext = stateToken ? await consumeWhatsAppOAuthState(stateToken) : null;
  if (stateContext) {
    return { status: "ok" as const, ...stateContext };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { status: "unauthenticated" as const };
  }

  const membership = await getCurrentMembership();
  if (!membership || !hasOrganizationRole(membership, ["owner", "admin"])) {
    return { status: "forbidden" as const };
  }

  return {
    status: "ok" as const,
    organizationId: membership.organizationId,
    userId: user.id,
  };
};

const redirectToLoginToResume = (request: NextRequest) => {
  const returnPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = "";
  loginUrl.hash = "";

  if (isSafeWhatsAppOAuthReturnPath(returnPath)) {
    loginUrl.searchParams.set("next", returnPath);
  }

  return NextResponse.redirect(loginUrl);
};

export async function GET(request: NextRequest) {
  if (!isWhatsAppOAuthConfigured()) {
    return redirectToSettings("missing_env");
  }

  const search = request.nextUrl.searchParams;
  const oauthError = search.get("error");

  if (oauthError) {
    return redirectToSettings(oauthError === "access_denied" ? "cancelled" : "signup_failed");
  }

  const code = search.get("code")?.trim();
  if (!code) {
    return redirectToSettings("invalid_callback");
  }

  const actor = await resolveConnectActor(search.get("state")?.trim() || undefined);
  if (actor.status === "unauthenticated") {
    return redirectToLoginToResume(request);
  }

  if (actor.status !== "ok") {
    return redirectToSettings("forbidden");
  }

  const status = await completeWhatsAppEmbeddedSignup({
    organizationId: actor.organizationId,
    userId: actor.userId,
    code,
    session: {
      wabaId: readQueryValue(search, ["waba_id", "wabaId"]),
      phoneNumberId: readQueryValue(search, ["phone_number_id", "phoneNumberId"]),
      businessId: readQueryValue(search, ["business_id", "businessId"]),
    },
    redirectUri: `${request.nextUrl.origin}${request.nextUrl.pathname}`,
  });

  return redirectToSettings(status);
}

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
  if (!stateContext || stateContext.organizationId !== membership.organizationId) {
    return jsonStatus("invalid_state", 400);
  }

  const status = await completeWhatsAppEmbeddedSignup({
    organizationId: stateContext.organizationId,
    userId: stateContext.userId,
    code: parsed.data.code,
    session: {
      wabaId: parsed.data.wabaId,
      phoneNumberId: parsed.data.phoneNumberId,
      businessId: parsed.data.businessId,
    },
  });

  const httpStatus = status === "connected" ? 200 : status === "no_numbers" ? 422 : 502;
  return jsonStatus(status, httpStatus);
}
