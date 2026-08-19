import type { MetaChannel } from "@/types/domain";

export type MetaWebhookKind = "social" | "whatsapp" | "auto";

export type PersistResult = {
  processed: number;
  duplicates: number;
  ignored: number;
};

export type InboundMessageEvent = {
  channel: MetaChannel;
  accountId: string;
  externalMessageId: string;
  externalUserId: string;
  displayName: string | null;
  phone: string | null;
  text: string | null;
  mediaUrl: string | null;
  timestamp: string;
  rawPayload: Record<string, unknown>;
};
