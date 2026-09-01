import { parseContactUsername } from "@/lib/contacts/display";
import { resolveMessagePreview } from "@/lib/media/parse";
import type { InboxConversation } from "@/app/(suite)/inbox/types";
import type { MetaChannel } from "@/types/domain";

const INBOX_CHANNELS: readonly MetaChannel[] = ["messenger", "instagram", "whatsapp"];
const INBOX_STATUSES = ["open", "in_progress", "resolved"] as const;
const INBOX_MODES = ["ai", "human"] as const;

export type ConversationListRow = {
  id: number;
  contact_id: number | null;
  channel: string;
  status: string;
  mode: string;
  assigned_user_id: string | null;
  updated_at: string;
  last_message_at: string | null;
  last_message_preview?: string | null;
  last_message_direction?: string | null;
  metadata: unknown;
  customer_phone?: string | null;
  contacts?: {
    full_name: string | null;
    phone: string | null;
    metadata: unknown;
  } | null;
};

const asRecord = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const isMetaChannel = (value: string): value is MetaChannel =>
  INBOX_CHANNELS.includes(value as MetaChannel);

const isInboxStatus = (value: string): value is InboxConversation["status"] =>
  INBOX_STATUSES.includes(value as InboxConversation["status"]);

const isInboxMode = (value: string): value is InboxConversation["mode"] =>
  INBOX_MODES.includes(value as InboxConversation["mode"]);

export const readUnreadCount = (metadata: unknown) => {
  const unreadRaw = asRecord(metadata)["unread_count"];
  return typeof unreadRaw === "number" && Number.isFinite(unreadRaw) && unreadRaw > 0
    ? Math.floor(unreadRaw)
    : 0;
};

export const readStoredPreview = (metadata: unknown) => {
  const preview = asRecord(metadata)["last_message_preview"];
  return typeof preview === "string" && preview.trim() ? preview.trim() : "";
};

export const mapConversationListRow = (
  row: ConversationListRow,
  latestPreview?: string,
): InboxConversation | null => {
  if (!isMetaChannel(row.channel) || !isInboxStatus(row.status) || !isInboxMode(row.mode)) {
    return null;
  }

  const storedPreview = row.last_message_preview?.trim() || readStoredPreview(row.metadata);
  const contactPhone = row.contacts?.phone || row.customer_phone || null;

  return {
    id: row.id,
    channel: row.channel,
    status: row.status,
    mode: row.mode,
    assignedUserId: row.assigned_user_id,
    updatedAt: row.updated_at,
    lastMessageAt: row.last_message_at,
    contactId: row.contact_id,
    contactName: row.contacts?.full_name?.trim() || "Contacto sin nombre",
    contactUsername: parseContactUsername(row.contacts?.metadata),
    contactPhone,
    lastMessagePreview: latestPreview?.trim() || storedPreview || "Sin mensajes recientes",
    unreadCount: readUnreadCount(row.metadata),
  };
};

export const mergeInboxConversations = (
  current: InboxConversation[],
  incoming: InboxConversation,
  activeConversationId?: number | null,
) => {
  const next = [incoming, ...current.filter((item) => item.id !== incoming.id)].sort((left, right) => {
    const leftTime = Date.parse(left.lastMessageAt || left.updatedAt);
    const rightTime = Date.parse(right.lastMessageAt || right.updatedAt);
    return rightTime - leftTime;
  });

  if (next.length <= 50) {
    return next;
  }

  const trimmed = next.slice(0, 50);
  if (activeConversationId && !trimmed.some((item) => item.id === activeConversationId)) {
    const active = next.find((item) => item.id === activeConversationId);
    if (active) {
      trimmed[trimmed.length - 1] = active;
    }
  }

  return trimmed;
};

export const previewFromMessageRow = (row: {
  content: string | null;
  media_url: string | null;
  metadata: unknown;
}) =>
  resolveMessagePreview({
    content: row.content,
    mediaUrl: row.media_url,
    metadata: row.metadata,
  });
