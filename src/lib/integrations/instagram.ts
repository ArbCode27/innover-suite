import { env } from "@/lib/config/env";

type ShortLivedTokenResponse = {
  access_token: string;
  user_id: string;
};

type LongLivedTokenResponse = {
  access_token: string;
  token_type?: string;
  expires_in: number;
};

type InstagramProfileResponse = {
  id: string;
  username?: string;
};

const INSTAGRAM_AUTHORIZE_URL = "https://www.instagram.com/oauth/authorize";
const INSTAGRAM_TOKEN_URL = "https://api.instagram.com/oauth/access_token";
const INSTAGRAM_GRAPH_BASE = "https://graph.instagram.com";

export const getSettingsRedirectUrl = (status: string) => {
  const redirectUrl = new URL("/settings", env.instagramRedirectUri || "http://localhost:3000");
  redirectUrl.searchParams.set("ig", status);
  return redirectUrl;
};

export const buildInstagramAuthorizationUrl = (state: string) => {
  const authUrl = new URL(INSTAGRAM_AUTHORIZE_URL);
  authUrl.searchParams.set("client_id", env.instagramAppId);
  authUrl.searchParams.set("redirect_uri", env.instagramRedirectUri);
  authUrl.searchParams.set(
    "scope",
    "instagram_business_basic,instagram_business_manage_messages",
  );
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("state", state);
  return authUrl;
};

export const exchangeAuthorizationCode = async (code: string) => {
  const body = new URLSearchParams({
    client_id: env.instagramAppId,
    client_secret: env.instagramAppSecret,
    grant_type: "authorization_code",
    redirect_uri: env.instagramRedirectUri,
    code,
  });

  const response = await fetch(INSTAGRAM_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    return {
      ok: false as const,
      status: response.status,
      errorBody: await response.text(),
    };
  }

  const json = (await response.json()) as ShortLivedTokenResponse;
  return { ok: true as const, data: json };
};

export const exchangeLongLivedToken = async (shortLivedToken: string) => {
  const url = new URL(`${INSTAGRAM_GRAPH_BASE}/access_token`);
  url.searchParams.set("grant_type", "ig_exchange_token");
  url.searchParams.set("client_secret", env.instagramAppSecret);
  url.searchParams.set("access_token", shortLivedToken);

  const response = await fetch(url);
  if (!response.ok) {
    return {
      ok: false as const,
      status: response.status,
      errorBody: await response.text(),
    };
  }

  const json = (await response.json()) as LongLivedTokenResponse;
  return { ok: true as const, data: json };
};

export const refreshLongLivedToken = async (longLivedToken: string) => {
  const url = new URL(`${INSTAGRAM_GRAPH_BASE}/refresh_access_token`);
  url.searchParams.set("grant_type", "ig_refresh_token");
  url.searchParams.set("access_token", longLivedToken);

  const response = await fetch(url);
  if (!response.ok) {
    return {
      ok: false as const,
      status: response.status,
      errorBody: await response.text(),
    };
  }

  const json = (await response.json()) as LongLivedTokenResponse;
  return { ok: true as const, data: json };
};

export const fetchInstagramProfile = async (accessToken: string) => {
  const url = new URL(`${INSTAGRAM_GRAPH_BASE}/me`);
  url.searchParams.set("fields", "id,username");
  url.searchParams.set("access_token", accessToken);

  const response = await fetch(url);
  if (!response.ok) {
    return {
      ok: false as const,
      status: response.status,
      errorBody: await response.text(),
    };
  }

  const json = (await response.json()) as InstagramProfileResponse;
  return { ok: true as const, data: json };
};

export const getExpiryDate = (expiresInSeconds: number) =>
  new Date(Date.now() + expiresInSeconds * 1000).toISOString();
