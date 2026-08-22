import type { MetaChannel } from "@/types/domain";
import { createMessageAttachment, type MessageAttachment, type MessageAttachmentKind } from "@/lib/media/types";
import { asArray, asNumber, asRecord, asString, toIsoTimestamp } from "@/lib/webhooks/meta/json";
import type { InboundMessageEvent } from "@/lib/webhooks/meta/types";

const SOCIAL_CHANNEL_BY_OBJECT: Record<string, MetaChannel> = {
  page: "messenger",
  instagram: "instagram",
};

const SOCIAL_ATTACHMENT_KIND: Record<string, MessageAttachmentKind> = {
  image: "image",
  video: "video",
  audio: "audio",
  file: "document",
  location: "location",
  ig_reel: "video",
  ig_story: "image",
  sticker: "sticker",
};

const extractSocialAttachment = (message: Record<string, unknown> | null): MessageAttachment | null => {
  if (!message) return null;

  const attachments = asArray(message.attachments);
  for (const attachment of attachments) {
    const record = asRecord(attachment);
    if (!record) continue;

    const type = asString(record.type)?.toLowerCase() ?? "";
    const payload = asRecord(record.payload);
    const kind = SOCIAL_ATTACHMENT_KIND[type];
    const url = asString(payload?.url);
    const coordinates = asRecord(payload?.coordinates);
    const lat = asNumber(coordinates?.lat) ?? asNumber(payload?.lat);
    const lng = asNumber(coordinates?.long) ?? asNumber(coordinates?.lng) ?? asNumber(payload?.long);

    if (kind === "location" && lat !== null && lng !== null) {
      return createMessageAttachment({
        kind: "location",
        status: "ready",
        location: {
          lat,
          lng,
          name: asString(payload?.title) ?? asString(payload?.name),
          address: asString(payload?.address),
        },
      });
    }

    if (!kind && !url) {
      continue;
    }

    return createMessageAttachment({
      kind: kind ?? "document",
      status: "pending",
      sourceUrl: url,
      mimeType: asString(payload?.mime_type),
      fileName: asString(payload?.name) ?? asString(payload?.filename),
    });
  }

  return null;
};

const extractRecipientId = (item: Record<string, unknown>) => {
  const recipient = asRecord(item.recipient);
  return asString(recipient?.id);
};

const extractSocialText = (item: Record<string, unknown>, attachment: MessageAttachment | null) => {
  const message = asRecord(item.message);
  const postback = asRecord(item.postback);
  const referral = asRecord(item.referral);

  return (
    asString(message?.text) ||
    asString(postback?.title) ||
    asString(postback?.payload) ||
    asString(referral?.ref) ||
    attachment?.caption ||
    null
  );
};

const toSocialEvent = (
  channel: MetaChannel,
  accountId: string,
  item: Record<string, unknown>,
): InboundMessageEvent | null => {
  const sender = asRecord(item.sender);
  const message = asRecord(item.message);
  const postback = asRecord(item.postback);
  const externalUserId = asString(sender?.id);
  const externalMessageId = asString(message?.mid) || asString(postback?.mid);
  const isEcho = message?.is_echo === true;
  const attachment = extractSocialAttachment(message);

  if (!externalUserId || !externalMessageId || isEcho || (!message && !postback)) {
    return null;
  }

  return {
    channel,
    accountId,
    externalMessageId,
    externalUserId,
    displayName: null,
    phone: null,
    text: extractSocialText(item, attachment),
    mediaUrl: attachment?.sourceUrl ?? null,
    attachment,
    timestamp: toIsoTimestamp(item.timestamp),
    rawPayload: item,
  };
};

const toSocialEventFromChange = (
  channel: MetaChannel,
  accountId: string,
  change: Record<string, unknown>,
): InboundMessageEvent | null => {
  const field = asString(change.field);
  if (field !== "messages") {
    return null;
  }

  const value = asRecord(change.value);
  if (!value) {
    return null;
  }

  return toSocialEvent(channel, accountId, value);
};

const resolveAccountId = (entry: Record<string, unknown>) => {
  const entryId = asString(entry.id);
  if (entryId) {
    return entryId;
  }

  for (const item of asArray(entry.messaging)) {
    const record = asRecord(item);
    const recipientId = record ? extractRecipientId(record) : null;
    if (recipientId) {
      return recipientId;
    }
  }

  for (const item of asArray(entry.changes)) {
    const change = asRecord(item);
    const value = asRecord(change?.value);
    const recipientId = value ? extractRecipientId(value) : null;
    if (recipientId) {
      return recipientId;
    }
  }

  return null;
};

export const normalizeSocialEvents = (payload: unknown): InboundMessageEvent[] => {
  const root = asRecord(payload);
  const objectType = asString(root?.object);
  const channel = objectType ? SOCIAL_CHANNEL_BY_OBJECT[objectType] : null;
  if (!root || !channel) {
    return [];
  }

  return asArray(root.entry).flatMap((entry) => {
    const record = asRecord(entry);
    if (!record) {
      return [];
    }

    const accountId = resolveAccountId(record);
    if (!accountId) {
      return [];
    }

    const messagingItems = [...asArray(record.messaging), ...asArray(record.standby)];
    const eventsFromMessaging = messagingItems.flatMap((item) => {
      const messagingItem = asRecord(item);
      if (!messagingItem) {
        return [];
      }

      const event = toSocialEvent(channel, accountId, messagingItem);
      return event ? [event] : [];
    });

    const eventsFromChanges = asArray(record.changes).flatMap((item) => {
      const change = asRecord(item);
      if (!change) {
        return [];
      }

      const event = toSocialEventFromChange(channel, accountId, change);
      return event ? [event] : [];
    });

    return [...eventsFromMessaging, ...eventsFromChanges];
  });
};
