import type { MetaChannel } from "@/types/domain";

const INSTAGRAM_GRAPH_VERSION = "v26.0";
const FACEBOOK_GRAPH_VERSION = "v26.0";
const PROFILE_FETCH_TIMEOUT_MS = 2500;

export type SocialUserProfile = {
  name: string | null;
  username: string | null;
};

type InstagramProfileResponse = {
  name?: string;
  username?: string;
};

type MessengerProfileResponse = {
  name?: string;
  first_name?: string;
  last_name?: string;
};

const createTimeoutSignal = () => {
  if (typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(PROFILE_FETCH_TIMEOUT_MS);
  }

  const controller = new AbortController();
  setTimeout(() => controller.abort(), PROFILE_FETCH_TIMEOUT_MS);
  return controller.signal;
};

const asTrimmedName = (value: string | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const fetchGraphJson = async <T>(url: string, accessToken: string) => {
  const response = await fetch(url, {
    method: "GET",
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    signal: createTimeoutSignal(),
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as T;
};

const fetchInstagramUserProfile = async (externalUserId: string, accessToken: string) => {
  const url = new URL(`https://graph.instagram.com/${INSTAGRAM_GRAPH_VERSION}/${externalUserId}`);
  url.searchParams.set("fields", "name,username");

  const json = await fetchGraphJson<InstagramProfileResponse>(url.toString(), accessToken);
  if (!json) {
    return null;
  }

  return {
    name: asTrimmedName(json.name),
    username: asTrimmedName(json.username)?.replace(/^@/, "") ?? null,
  } satisfies SocialUserProfile;
};

const fetchMessengerUserProfile = async (externalUserId: string, accessToken: string) => {
  const url = new URL(`https://graph.facebook.com/${FACEBOOK_GRAPH_VERSION}/${externalUserId}`);
  url.searchParams.set("fields", "name,first_name,last_name");

  const json = await fetchGraphJson<MessengerProfileResponse>(url.toString(), accessToken);
  if (!json) {
    return null;
  }

  const composedName = [json.first_name, json.last_name].filter(Boolean).join(" ").trim();

  return {
    name: asTrimmedName(json.name) || asTrimmedName(composedName),
    username: null,
  } satisfies SocialUserProfile;
};

export const fetchSocialUserProfile = async (
  channel: MetaChannel,
  externalUserId: string,
  accessToken: string,
): Promise<SocialUserProfile | null> => {
  if (channel === "instagram") {
    return fetchInstagramUserProfile(externalUserId, accessToken);
  }

  if (channel === "messenger") {
    return fetchMessengerUserProfile(externalUserId, accessToken);
  }

  return null;
};

export const resolveProfileDisplayName = (profile: SocialUserProfile) => {
  if (profile.name) {
    return profile.name;
  }

  if (profile.username) {
    return `@${profile.username}`;
  }

  return null;
};
