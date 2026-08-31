import { env } from "@/lib/config/env";
import { resolveIntegrationReturnPath } from "@/lib/integrations/oauth-href";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const WHATSAPP_GRAPH_VERSION = "v26.0";
const FACEBOOK_GRAPH_BASE = `https://graph.facebook.com/${WHATSAPP_GRAPH_VERSION}`;

type GraphTokenResponse = {
  access_token: string;
  token_type?: string;
  expires_in?: number;
};

export type WhatsAppPhoneNumber = {
  id: string;
  displayPhoneNumber: string | null;
  verifiedName: string | null;
  qualityRating: string | null;
};

type GraphPhoneNumber = {
  id?: string;
  display_phone_number?: string;
  verified_name?: string;
  quality_rating?: string;
};

type GraphListResponse<T> = {
  data?: T[];
};

type GraphBusiness = {
  id?: string;
  owned_whatsapp_business_accounts?: GraphListResponse<{ id?: string }>;
};

type GraphApiSuccess = {
  success?: boolean;
};

type GraphResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; errorBody: string };

export type WhatsAppSessionInfo = {
  wabaId?: string;
  phoneNumberId?: string;
  businessId?: string;
};

const asRecord = (value: unknown) =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : null;

const asString = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);

const mapPhoneNumber = (row: GraphPhoneNumber): WhatsAppPhoneNumber | null => {
  const id = asString(row.id);
  if (!id) return null;

  return {
    id,
    displayPhoneNumber: asString(row.display_phone_number),
    verifiedName: asString(row.verified_name),
    qualityRating: asString(row.quality_rating),
  };
};

const graphRequest = async <T>(
  path: string,
  accessToken: string,
  init?: RequestInit,
): Promise<GraphResult<T>> => {
  const response = await fetch(`${FACEBOOK_GRAPH_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      errorBody: await response.text(),
    };
  }

  return { ok: true, data: (await response.json()) as T };
};

export const isWhatsAppOAuthConfigured = () => Boolean(env.facebookAppId && env.metaAppSecret);

export const isWhatsAppEmbeddedSignupConfigured = () =>
  Boolean(isWhatsAppOAuthConfigured() && env.whatsappEmbeddedConfigId);

export const getWhatsAppOAuthRedirectUri = () => {
  const originSource = env.facebookRedirectUri || env.instagramRedirectUri || "http://localhost:3000";
  return new URL("/api/auth/whatsapp/callback", originSource).toString();
};

export const getWhatsAppSettingsRedirectUrl = (status: string, returnPath?: string | null) => {
  const originSource = env.facebookRedirectUri || env.instagramRedirectUri || "http://localhost:3000";
  const path = resolveIntegrationReturnPath(returnPath);
  const redirectUrl = new URL(path, originSource);
  redirectUrl.searchParams.set("wa", status);
  if (path === "/settings" || path.startsWith("/settings?")) {
    redirectUrl.hash = "whatsapp";
  }
  return redirectUrl;
};

export { isSafeWhatsAppOAuthReturnPath } from "@/lib/auth/return-path";

export const exchangeWhatsAppAuthorizationCode = async (code: string, redirectUri?: string) => {
  const url = new URL(`${FACEBOOK_GRAPH_BASE}/oauth/access_token`);
  url.searchParams.set("client_id", env.facebookAppId);
  url.searchParams.set("client_secret", env.metaAppSecret);
  url.searchParams.set("code", code);
  if (redirectUri) {
    url.searchParams.set("redirect_uri", redirectUri);
  }

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    return {
      ok: false as const,
      status: response.status,
      errorBody: await response.text(),
    };
  }

  const json = (await response.json()) as GraphTokenResponse;
  if (!json.access_token) {
    return { ok: false as const, status: 502, errorBody: "Facebook no devolvió access_token." };
  }

  return { ok: true as const, data: json };
};

export const exchangeLongLivedWhatsAppToken = async (shortLivedToken: string) => {
  const url = new URL(`${FACEBOOK_GRAPH_BASE}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", env.facebookAppId);
  url.searchParams.set("client_secret", env.metaAppSecret);
  url.searchParams.set("fb_exchange_token", shortLivedToken);

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    return {
      ok: false as const,
      status: response.status,
      errorBody: await response.text(),
    };
  }

  const json = (await response.json()) as GraphTokenResponse;
  if (!json.access_token) {
    return { ok: false as const, status: 502, errorBody: "Facebook no devolvió el token de larga duración." };
  }

  return { ok: true as const, data: json };
};

export const resolveAccessToken = async (shortLivedToken: string) => {
  const longLived = await exchangeLongLivedWhatsAppToken(shortLivedToken);
  if (longLived.ok) {
    return longLived.data.access_token;
  }

  console.warn("[WA_EMBEDDED] long-lived token exchange failed, using short-lived token", {
    status: longLived.status,
    body: longLived.errorBody,
  });
  return shortLivedToken;
};

export const fetchWabaPhoneNumbers = async (wabaId: string, accessToken: string) => {
  const result = await graphRequest<GraphListResponse<GraphPhoneNumber>>(
    `/${encodeURIComponent(wabaId)}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating`,
    accessToken,
  );
  if (!result.ok) {
    return result;
  }

  return {
    ok: true as const,
    data: (result.data.data ?? []).map(mapPhoneNumber).filter((row): row is WhatsAppPhoneNumber => Boolean(row)),
  };
};

export const fetchWhatsAppPhoneNumber = async (phoneNumberId: string, accessToken: string) => {
  const result = await graphRequest<GraphPhoneNumber>(
    `/${encodeURIComponent(phoneNumberId)}?fields=id,display_phone_number,verified_name,quality_rating`,
    accessToken,
  );
  if (!result.ok) {
    return result;
  }

  const mapped = mapPhoneNumber(result.data);
  if (!mapped) {
    return { ok: false as const, status: 502, errorBody: "El número de WhatsApp no incluye un ID válido." };
  }

  return { ok: true as const, data: mapped };
};

export const discoverOwnedWabaIds = async (accessToken: string) => {
  const result = await graphRequest<GraphListResponse<GraphBusiness>>(
    "/me/businesses?fields=id,owned_whatsapp_business_accounts{id}",
    accessToken,
  );
  if (!result.ok) {
    return result;
  }

  const wabaIds = new Set<string>();
  for (const business of result.data.data ?? []) {
    for (const account of business.owned_whatsapp_business_accounts?.data ?? []) {
      const wabaId = asString(account.id);
      if (wabaId) wabaIds.add(wabaId);
    }
  }

  return { ok: true as const, data: [...wabaIds] };
};

export const subscribeWabaToAppWebhooks = async (wabaId: string, accessToken: string) =>
  graphRequest<GraphApiSuccess>(`/${encodeURIComponent(wabaId)}/subscribed_apps`, accessToken, {
    method: "POST",
  });

export const unsubscribeWabaFromAppWebhooks = async (wabaId: string, accessToken: string) =>
  graphRequest<GraphApiSuccess>(`/${encodeURIComponent(wabaId)}/subscribed_apps`, accessToken, {
    method: "DELETE",
  });

export const resolveWhatsAppPhoneNumbers = async (
  session: WhatsAppSessionInfo,
  accessToken: string,
) => {
  const wabaIds = new Set<string>();
  if (session.wabaId) {
    wabaIds.add(session.wabaId);
  }

  if (!wabaIds.size) {
    const discovered = await discoverOwnedWabaIds(accessToken);
    if (!discovered.ok) {
      return discovered;
    }
    discovered.data.forEach((id) => wabaIds.add(id));
  }

  const numbersById = new Map<string, WhatsAppPhoneNumber>();
  const wabaIdByPhoneId = new Map<string, string>();

  for (const wabaId of wabaIds) {
    const listed = await fetchWabaPhoneNumbers(wabaId, accessToken);
    if (!listed.ok) {
      console.error("[WA_EMBEDDED] waba phone list failed", {
        wabaId,
        status: listed.status,
        body: listed.errorBody,
      });
      continue;
    }

    for (const phone of listed.data) {
      numbersById.set(phone.id, phone);
      wabaIdByPhoneId.set(phone.id, wabaId);
    }
  }

  if (session.phoneNumberId && !numbersById.has(session.phoneNumberId)) {
    const single = await fetchWhatsAppPhoneNumber(session.phoneNumberId, accessToken);
    if (single.ok) {
      numbersById.set(single.data.id, single.data);
      if (session.wabaId) {
        wabaIdByPhoneId.set(single.data.id, session.wabaId);
      }
    }
  }

  if (!numbersById.size) {
    return { ok: false as const, status: 404, errorBody: "No se encontró ningún número de WhatsApp autorizado." };
  }

  return {
    ok: true as const,
    data: {
      phones: [...numbersById.values()],
      wabaIdByPhoneId,
      wabaIds: [...wabaIds],
    },
  };
};

export const parseWhatsAppAccountMetadata = (value: unknown) => {
  const record = asRecord(value);
  return {
    wabaId: asString(record?.wabaId),
    businessId: asString(record?.businessId),
    displayPhoneNumber: asString(record?.displayPhoneNumber),
    verifiedName: asString(record?.verifiedName),
    qualityRating: asString(record?.qualityRating),
  };
};

export type WhatsAppConnectStatus =
  | "connected"
  | "token_exchange_failed"
  | "invalid_token"
  | "invalid_phone"
  | "waba_mismatch"
  | "waba_required"
  | "no_numbers"
  | "persist_failed"
  | "subscription_failed";

export type WhatsAppTokenProvider = "whatsapp_embedded_signup" | "whatsapp_system_user";

type GraphDebugToken = {
  data?: {
    app_id?: string;
    type?: string;
    is_valid?: boolean;
    expires_at?: number;
    scopes?: string[];
    granular_scopes?: Array<{ scope?: string; target_ids?: string[] }>;
  };
};

type WhatsAppTokenInspection = {
  isValid: boolean;
  tokenKind: "system_user" | "user";
  expiresAt: string | null;
  wabaIds: string[];
};

const persistWhatsAppPhoneConnections = async (input: {
  organizationId: number;
  userId: string;
  accessToken: string;
  phones: WhatsAppPhoneNumber[];
  wabaIdByPhoneId: Map<string, string>;
  wabaIds: string[];
  businessId?: string | null;
  provider: WhatsAppTokenProvider;
  tokenKind?: "system_user" | "user" | null;
  tokenExpiresAt?: string | null;
}): Promise<WhatsAppConnectStatus> => {
  const admin = getSupabaseAdminClient();
  const connectedAt = new Date().toISOString();
  let persistedCount = 0;

  for (const phone of input.phones) {
    const wabaId = input.wabaIdByPhoneId.get(phone.id) ?? null;
    const displayName = phone.verifiedName || phone.displayPhoneNumber || "WhatsApp";
    const { error: channelAccountError } = await admin.from("channel_accounts").upsert(
      {
        organization_id: input.organizationId,
        channel: "whatsapp",
        external_account_id: phone.id,
        display_name: displayName,
        access_token: input.accessToken,
        connected_by_user_id: input.userId,
        metadata: {
          provider: input.provider,
          wabaId,
          businessId: input.businessId ?? null,
          displayPhoneNumber: phone.displayPhoneNumber,
          verifiedName: phone.verifiedName,
          qualityRating: phone.qualityRating,
          tokenKind: input.tokenKind ?? null,
          tokenExpiresAt: input.tokenExpiresAt ?? null,
          connectedAt,
        },
      },
      { onConflict: "channel,external_account_id" },
    );

    if (channelAccountError) {
      console.error("[WA_CONNECT] upsert channel account failed", {
        phoneNumberId: phone.id,
        error: channelAccountError,
      });
      continue;
    }

    persistedCount += 1;
  }

  if (persistedCount === 0) {
    return "persist_failed";
  }

  const uniqueWabaIds = [...new Set(input.wabaIds.filter(Boolean))];
  let subscribedCount = 0;
  for (const wabaId of uniqueWabaIds) {
    const subscription = await subscribeWabaToAppWebhooks(wabaId, input.accessToken);
    if (!subscription.ok) {
      console.error("[WA_CONNECT] waba webhook subscription failed", {
        wabaId,
        status: subscription.status,
        body: subscription.errorBody,
      });
      continue;
    }
    subscribedCount += 1;
  }

  if (uniqueWabaIds.length > 0 && subscribedCount === 0) {
    return "subscription_failed";
  }

  return "connected";
};

export const inspectWhatsAppAccessToken = async (
  accessToken: string,
): Promise<WhatsAppTokenInspection | null> => {
  if (!env.facebookAppId || !env.metaAppSecret) {
    return null;
  }

  const url = new URL(`${FACEBOOK_GRAPH_BASE}/debug_token`);
  url.searchParams.set("input_token", accessToken);
  url.searchParams.set("access_token", `${env.facebookAppId}|${env.metaAppSecret}`);

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    console.error("[WA_CONNECT] debug_token failed", { status: response.status });
    return null;
  }

  const json = (await response.json()) as GraphDebugToken;
  const data = json.data;
  if (!data) {
    return null;
  }

  const wabaIds = new Set<string>();
  for (const scope of data.granular_scopes ?? []) {
    if (!scope.scope?.includes("whatsapp")) continue;
    for (const targetId of scope.target_ids ?? []) {
      const id = asString(targetId);
      if (id) wabaIds.add(id);
    }
  }

  const expiresAt =
    typeof data.expires_at === "number" && data.expires_at > 0
      ? new Date(data.expires_at * 1000).toISOString()
      : null;

  return {
    isValid: data.is_valid !== false,
    tokenKind: data.type === "SYSTEM" || data.expires_at === 0 ? "system_user" : "user",
    expiresAt,
    wabaIds: [...wabaIds],
  };
};

export const discoverAssignedWabaIds = async (accessToken: string) => {
  const me = await graphRequest<{ id?: string }>("/me?fields=id", accessToken);
  if (!me.ok) {
    return me;
  }

  const userId = asString(me.data.id);
  if (!userId) {
    return { ok: true as const, data: [] as string[] };
  }

  const assigned = await graphRequest<GraphListResponse<{ id?: string }>>(
    `/${encodeURIComponent(userId)}/assigned_whatsapp_business_accounts?fields=id`,
    accessToken,
  );
  if (!assigned.ok) {
    return assigned;
  }

  const wabaIds = (assigned.data.data ?? [])
    .map((row) => asString(row.id))
    .filter((id): id is string => Boolean(id));

  return { ok: true as const, data: wabaIds };
};

const findWabaIdForPhone = async (
  phoneNumberId: string,
  accessToken: string,
  candidates: string[],
) => {
  for (const wabaId of [...new Set(candidates.filter(Boolean))]) {
    const listed = await fetchWabaPhoneNumbers(wabaId, accessToken);
    if (!listed.ok) {
      continue;
    }
    if (listed.data.some((phone) => phone.id === phoneNumberId)) {
      return wabaId;
    }
  }

  return null;
};

export const completeWhatsAppEmbeddedSignup = async (input: {
  organizationId: number;
  userId: string;
  code: string;
  session?: WhatsAppSessionInfo;
  redirectUri?: string;
}): Promise<WhatsAppConnectStatus> => {
  let shortToken = await exchangeWhatsAppAuthorizationCode(input.code, input.redirectUri);
  if (!shortToken.ok && input.redirectUri) {
    shortToken = await exchangeWhatsAppAuthorizationCode(input.code);
  }

  if (!shortToken.ok) {
    console.error("[WA_EMBEDDED] code exchange failed", {
      status: shortToken.status,
      body: shortToken.errorBody,
    });
    return "token_exchange_failed";
  }

  const accessToken = await resolveAccessToken(shortToken.data.access_token);
  const session = input.session ?? {};
  const numbers = await resolveWhatsAppPhoneNumbers(session, accessToken);

  if (!numbers.ok) {
    console.error("[WA_EMBEDDED] phone discovery failed", {
      status: numbers.status,
      body: numbers.errorBody,
    });
    return "no_numbers";
  }

  return persistWhatsAppPhoneConnections({
    organizationId: input.organizationId,
    userId: input.userId,
    accessToken,
    phones: numbers.data.phones,
    wabaIdByPhoneId: numbers.data.wabaIdByPhoneId,
    wabaIds: numbers.data.wabaIds,
    businessId: session.businessId,
    provider: "whatsapp_embedded_signup",
    tokenKind: "user",
  });
};

export const completeWhatsAppManualTokenConnect = async (input: {
  organizationId: number;
  userId: string;
  accessToken: string;
  phoneNumberId: string;
  wabaId?: string;
}): Promise<WhatsAppConnectStatus> => {
  const inspection = await inspectWhatsAppAccessToken(input.accessToken);
  if (inspection && !inspection.isValid) {
    return "invalid_token";
  }

  const phone = await fetchWhatsAppPhoneNumber(input.phoneNumberId, input.accessToken);
  if (!phone.ok) {
    console.error("[WA_CONNECT] phone lookup failed", {
      status: phone.status,
    });
    if (phone.status === 401 || phone.status === 403) {
      return "invalid_token";
    }
    return "invalid_phone";
  }

  const candidateWabaIds: string[] = [];
  if (input.wabaId) {
    candidateWabaIds.push(input.wabaId);
  }
  if (inspection?.wabaIds.length) {
    candidateWabaIds.push(...inspection.wabaIds);
  }

  const assigned = await discoverAssignedWabaIds(input.accessToken);
  if (assigned.ok) {
    candidateWabaIds.push(...assigned.data);
  }

  const owned = await discoverOwnedWabaIds(input.accessToken);
  if (owned.ok) {
    candidateWabaIds.push(...owned.data);
  }

  let wabaId = await findWabaIdForPhone(input.phoneNumberId, input.accessToken, candidateWabaIds);

  if (!wabaId && input.wabaId) {
    const listed = await fetchWabaPhoneNumbers(input.wabaId, input.accessToken);
    if (listed.ok && !listed.data.some((row) => row.id === input.phoneNumberId)) {
      return "waba_mismatch";
    }
    wabaId = input.wabaId;
  }

  if (!wabaId && candidateWabaIds.length === 1) {
    wabaId = candidateWabaIds[0] ?? null;
  }

  if (!wabaId) {
    return "waba_required";
  }

  const wabaIdByPhoneId = new Map<string, string>([[phone.data.id, wabaId]]);

  return persistWhatsAppPhoneConnections({
    organizationId: input.organizationId,
    userId: input.userId,
    accessToken: input.accessToken,
    phones: [phone.data],
    wabaIdByPhoneId,
    wabaIds: [wabaId],
    provider: "whatsapp_system_user",
    tokenKind: inspection?.tokenKind ?? "system_user",
    tokenExpiresAt: inspection?.expiresAt ?? null,
  });
};

