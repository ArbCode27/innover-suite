import type { MetaChannel } from "@/types/domain";

export const PLACEHOLDER_CONTACT_PREFIX = "Contacto ";

export const CHANNEL_LABELS: Record<MetaChannel, string> = {
  instagram: "Instagram",
  messenger: "Messenger",
  whatsapp: "WhatsApp",
};

export const isPlaceholderContactName = (name: string) =>
  name.trim().toLowerCase().startsWith(PLACEHOLDER_CONTACT_PREFIX.toLowerCase());

export const parseContactUsername = (metadata: unknown) => {
  if (!metadata || typeof metadata !== "object") {
    return null;
  }

  const username = (metadata as Record<string, unknown>).username;
  if (typeof username !== "string") {
    return null;
  }

  const normalized = username.trim().replace(/^@/, "");
  return normalized || null;
};

export const formatSocialHandle = (username: string | null | undefined) => {
  if (!username?.trim()) {
    return null;
  }

  return `@${username.trim().replace(/^@/, "")}`;
};

export const fallbackContactName = (channel: MetaChannel, displayName?: string | null) =>
  displayName?.trim() || `${PLACEHOLDER_CONTACT_PREFIX}${CHANNEL_LABELS[channel]}`;
