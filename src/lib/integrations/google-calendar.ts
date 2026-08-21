import { env } from "@/lib/config/env";

type GoogleTokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  id_token?: string;
};

type GoogleUserInfo = {
  id?: string;
  sub?: string;
  email?: string;
  name?: string;
};

type GoogleCalendarListResponse = {
  items?: Array<{
    id?: string;
    primary?: boolean;
    accessRole?: string;
  }>;
};

type GoogleApiError = {
  ok: false;
  status: number;
  errorBody: string;
};

const GOOGLE_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";
const GOOGLE_CALENDAR_LIST_URL = "https://www.googleapis.com/calendar/v3/users/me/calendarList";

const GOOGLE_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.freebusy",
];

const asError = async (response: Response): Promise<GoogleApiError> => ({
  ok: false,
  status: response.status,
  errorBody: await response.text(),
});

export const isGoogleOAuthConfigured = () =>
  Boolean(env.googleClientId && env.googleClientSecret && env.googleRedirectUri);

export const getGoogleSettingsRedirectUrl = (status: string) => {
  const originSource = env.googleRedirectUri || env.instagramRedirectUri || "http://localhost:3000";
  const redirectUrl = new URL("/settings", originSource);
  redirectUrl.searchParams.set("gc", status);
  return redirectUrl;
};

export const buildGoogleAuthorizationUrl = (state: string) => {
  const authUrl = new URL(GOOGLE_AUTHORIZE_URL);
  authUrl.searchParams.set("client_id", env.googleClientId);
  authUrl.searchParams.set("redirect_uri", env.googleRedirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", GOOGLE_SCOPES.join(" "));
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");
  authUrl.searchParams.set("include_granted_scopes", "true");
  authUrl.searchParams.set("state", state);
  return authUrl;
};

export const exchangeGoogleAuthorizationCode = async (code: string) => {
  const body = new URLSearchParams({
    client_id: env.googleClientId,
    client_secret: env.googleClientSecret,
    redirect_uri: env.googleRedirectUri,
    grant_type: "authorization_code",
    code,
  });

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    return asError(response);
  }

  const json = (await response.json()) as GoogleTokenResponse;
  return { ok: true as const, data: json };
};

export const refreshGoogleAccessToken = async (refreshToken: string) => {
  const body = new URLSearchParams({
    client_id: env.googleClientId,
    client_secret: env.googleClientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    return asError(response);
  }

  const json = (await response.json()) as GoogleTokenResponse;
  return { ok: true as const, data: json };
};

export const fetchGoogleUserInfo = async (accessToken: string) => {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!response.ok) {
    return asError(response);
  }

  const json = (await response.json()) as GoogleUserInfo;
  return { ok: true as const, data: json };
};

export const fetchPrimaryGoogleCalendarId = async (accessToken: string) => {
  const url = new URL(GOOGLE_CALENDAR_LIST_URL);
  url.searchParams.set("minAccessRole", "writer");

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!response.ok) {
    return "primary";
  }

  const json = (await response.json()) as GoogleCalendarListResponse;
  const primaryCalendar = json.items?.find((item) => item.primary && item.id);
  return primaryCalendar?.id || json.items?.[0]?.id || "primary";
};

export const revokeGoogleToken = async (token: string) => {
  const body = new URLSearchParams({ token });
  const response = await fetch(GOOGLE_REVOKE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok && response.status !== 400) {
    return asError(response);
  }

  return { ok: true as const };
};

export const getGoogleTokenExpiryDate = (expiresInSeconds: number) => {
  const safeSeconds = Math.max(expiresInSeconds - 60, 30);
  return new Date(Date.now() + safeSeconds * 1000).toISOString();
};

export const isInvalidGoogleGrant = (errorBody: string) =>
  errorBody.includes("invalid_grant") || errorBody.includes("invalid_token");
