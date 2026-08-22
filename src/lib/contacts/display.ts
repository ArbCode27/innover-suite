import type { MetaChannel } from "@/types/domain";

export const PLACEHOLDER_CONTACT_PREFIX = "Contacto ";

export const CHANNEL_LABELS: Record<MetaChannel, string> = {
  instagram: "Instagram",
  messenger: "Messenger",
  whatsapp: "WhatsApp",
};

export const CHANNEL_BADGE_CLASSNAMES: Record<MetaChannel, string> = {
  instagram:
    "border-[#E1306C]/35 bg-[linear-gradient(90deg,rgba(245,133,41,0.16),rgba(221,42,123,0.16),rgba(129,52,175,0.16))] text-[#C13584] dark:border-[#E1306C]/45 dark:text-[#F77737]",
  messenger:
    "border-[#0084FF]/35 bg-[#0084FF]/12 text-[#006AFF] dark:border-[#5B9EFF]/45 dark:bg-[#0084FF]/18 dark:text-[#5B9EFF]",
  whatsapp:
    "border-[#25D366]/40 bg-[#25D366]/12 text-[#128C7E] dark:border-[#25D366]/45 dark:bg-[#25D366]/18 dark:text-[#25D366]",
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
