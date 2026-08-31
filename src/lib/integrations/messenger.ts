import { env } from "@/lib/config/env";
import { resolveIntegrationReturnPath } from "@/lib/integrations/oauth-href";

type FacebookTokenResponse = {
  access_token: string;
  token_type?: string;
  expires_in?: number;
};

export type FacebookPageAccount = {
  id: string;
  name: string;
  access_token?: string;
  tasks?: string[];
};

type FacebookPagesResponse = {
  data?: FacebookPageAccount[];
};

type FacebookApiSuccess = {
  success?: boolean;
};

const FACEBOOK_GRAPH_VERSION = "v26.0";
const FACEBOOK_AUTHORIZE_URL = `https://www.facebook.com/${FACEBOOK_GRAPH_VERSION}/dialog/oauth`;
const FACEBOOK_GRAPH_BASE = `https://graph.facebook.com/${FACEBOOK_GRAPH_VERSION}`;
const MESSENGER_SCOPES = [
  "pages_show_list",
  "pages_messaging",
  "pages_manage_metadata",
];

export const isMessengerOAuthConfigured = () =>
  Boolean(env.facebookAppId && env.metaAppSecret && env.facebookRedirectUri);

export const getMessengerSettingsRedirectUrl = (status: string, returnPath?: string | null) => {
  const redirectUrl = new URL(
    resolveIntegrationReturnPath(returnPath),
    env.facebookRedirectUri || "http://localhost:3000",
  );
  redirectUrl.searchParams.set("ms", status);
  return redirectUrl;
};

export const buildMessengerAuthorizationUrl = (state: string) => {
  const authUrl = new URL(FACEBOOK_AUTHORIZE_URL);
  authUrl.searchParams.set("client_id", env.facebookAppId);
  authUrl.searchParams.set("redirect_uri", env.facebookRedirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", MESSENGER_SCOPES.join(","));
  authUrl.searchParams.set("state", state);
  return authUrl;
};

export const exchangeFacebookAuthorizationCode = async (code: string) => {
  const url = new URL(`${FACEBOOK_GRAPH_BASE}/oauth/access_token`);
  url.searchParams.set("client_id", env.facebookAppId);
  url.searchParams.set("client_secret", env.metaAppSecret);
  url.searchParams.set("redirect_uri", env.facebookRedirectUri);
  url.searchParams.set("code", code);

  const response = await fetch(url);
  if (!response.ok) {
    return {
      ok: false as const,
      status: response.status,
      errorBody: await response.text(),
    };
  }

  const json = (await response.json()) as FacebookTokenResponse;
  return { ok: true as const, data: json };
};

export const exchangeLongLivedFacebookToken = async (shortLivedToken: string) => {
  const url = new URL(`${FACEBOOK_GRAPH_BASE}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", env.facebookAppId);
  url.searchParams.set("client_secret", env.metaAppSecret);
  url.searchParams.set("fb_exchange_token", shortLivedToken);

  const response = await fetch(url);
  if (!response.ok) {
    return {
      ok: false as const,
      status: response.status,
      errorBody: await response.text(),
    };
  }

  const json = (await response.json()) as FacebookTokenResponse;
  return { ok: true as const, data: json };
};

export const fetchFacebookPages = async (userAccessToken: string) => {
  const url = new URL(`${FACEBOOK_GRAPH_BASE}/me/accounts`);
  url.searchParams.set("fields", "id,name,access_token,tasks");
  url.searchParams.set("access_token", userAccessToken);

  const response = await fetch(url);
  if (!response.ok) {
    return {
      ok: false as const,
      status: response.status,
      errorBody: await response.text(),
    };
  }

  const json = (await response.json()) as FacebookPagesResponse;
  return { ok: true as const, data: json.data ?? [] };
};

export const subscribePageToMessengerWebhooks = async (pageId: string, pageAccessToken: string) => {
  const url = new URL(`${FACEBOOK_GRAPH_BASE}/${pageId}/subscribed_apps`);
  url.searchParams.set("subscribed_fields", "messages,messaging_postbacks");
  url.searchParams.set("access_token", pageAccessToken);

  const response = await fetch(url, { method: "POST" });
  if (!response.ok) {
    return {
      ok: false as const,
      status: response.status,
      errorBody: await response.text(),
    };
  }

  const json = (await response.json()) as FacebookApiSuccess;
  return { ok: true as const, data: json };
};

export const unsubscribePageFromMessengerWebhooks = async (pageId: string, pageAccessToken: string) => {
  const url = new URL(`${FACEBOOK_GRAPH_BASE}/${pageId}/subscribed_apps`);
  url.searchParams.set("access_token", pageAccessToken);

  const response = await fetch(url, { method: "DELETE" });
  if (!response.ok) {
    return {
      ok: false as const,
      status: response.status,
      errorBody: await response.text(),
    };
  }

  const json = (await response.json()) as FacebookApiSuccess;
  return { ok: true as const, data: json };
};
