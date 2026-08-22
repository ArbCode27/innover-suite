import { parseMessageAttachment } from "@/lib/media/parse";
import type { MessageAttachmentKind, MessageAttachmentStatus, MessageLocation } from "@/lib/media/types";

export type InboxFilter = "all" | "unread" | "ai" | "human" | "mine" | "unassigned";

export type AttachmentKind = MessageAttachmentKind;
export type FileAttachmentKind = "image" | "video" | "audio" | "document";
export type DeliveryStatus = "pending" | "sent" | "failed";

export type InboxConversation = {
  id: number;
  channel: "messenger" | "instagram" | "whatsapp";
  status: "open" | "in_progress" | "resolved";
  mode: "ai" | "human";
  assignedUserId: string | null;
  updatedAt: string;
  lastMessageAt: string | null;
  contactId: number | null;
  contactName: string;
  contactUsername: string | null;
  contactPhone: string | null;
  lastMessagePreview: string;
  unreadCount: number;
};

export type InboxMessage = {
  id: number;
  conversationId: number;
  direction: "inbound" | "outbound";
  senderType: "contact" | "agent" | "ai" | "system";
  content: string | null;
  mediaUrl: string | null;
  createdAt: string;
  attachmentKind: AttachmentKind | null;
  attachmentName: string | null;
  attachmentStatus: MessageAttachmentStatus | null;
  location: MessageLocation | null;
  isVoice: boolean;
  deliveryStatus: DeliveryStatus | null;
};

export const parseDeliveryStatus = (metadata: Record<string, unknown>): DeliveryStatus | null => {
  const value = metadata["delivery_status"];
  if (value === "pending" || value === "sent" || value === "failed") {
    return value;
  }
  return null;
};

export const asMessageMetadata = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

export const normalizeInboxMessage = (row: {
  id: number;
  conversation_id: number;
  direction: "inbound" | "outbound";
  sender_type: "contact" | "agent" | "ai" | "system";
  content: string | null;
  media_url: string | null;
  metadata: unknown;
  created_at: string;
}): InboxMessage => {
  const metadata = asMessageMetadata(row.metadata);
  const attachment = parseMessageAttachment(metadata);

  return {
    id: row.id,
    conversationId: row.conversation_id,
    direction: row.direction,
    senderType: row.sender_type,
    content: row.content,
    mediaUrl: row.media_url,
    createdAt: row.created_at,
    attachmentKind: attachment?.kind ?? null,
    attachmentName: attachment?.fileName ?? null,
    attachmentStatus: attachment?.status ?? null,
    location: attachment?.location ?? null,
    isVoice: attachment?.isVoice ?? false,
    deliveryStatus: parseDeliveryStatus(metadata),
  };
};
