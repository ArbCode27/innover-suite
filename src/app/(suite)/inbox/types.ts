export type InboxFilter = "all" | "unread" | "ai" | "human";

export type AttachmentKind = "image" | "video" | "audio" | "document";
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
  deliveryStatus: DeliveryStatus | null;
};

export const parseDeliveryStatus = (metadata: Record<string, unknown>): DeliveryStatus | null => {
  const value = metadata["delivery_status"];
  if (value === "pending" || value === "sent" || value === "failed") {
    return value;
  }
  return null;
};
