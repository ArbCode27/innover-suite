import type { MetaChannel } from "@/types/domain";
import type { MessageAttachment } from "@/lib/media/types";

export type MetaWebhookKind = "social" | "whatsapp" | "auto";

export type PersistResult = {
  processed: number;
  duplicates: number;
  ignored: number;
  mediaJobs: Array<{
    organizationId: number;
    conversationId: number;
    inboundMessageId: number;
  }>;
  agentJobs: Array<{
    organizationId: number;
    conversationId: number;
    inboundMessageId: number;
  }>;
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
  attachment: MessageAttachment | null;
  timestamp: string;
  rawPayload: Record<string, unknown>;
};
