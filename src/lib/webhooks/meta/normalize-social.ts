import type { MetaChannel } from "@/types/domain";
import { asArray, asRecord, asString, toIsoTimestamp } from "@/lib/webhooks/meta/json";
import type { InboundMessageEvent } from "@/lib/webhooks/meta/types";

const SOCIAL_CHANNEL_BY_OBJECT: Record<string, MetaChannel> = {
  page: "messenger",
  instagram: "instagram",
};

const extractAttachmentUrl = (message: Record<string, unknown>) => {
  const attachments = asArray(message.attachments);
  for (const attachment of attachments) {
    const record = asRecord(attachment);
    const payload = asRecord(record?.payload);
    const url = asString(payload?.url);
    if (url) {
      return url;
    }
  }

  return null;
};

const extractRecipientId = (item: Record<string, unknown>) => {
  const recipient = asRecord(item.recipient);
  return asString(recipient?.id);
};

const extractSocialText = (item: Record<string, unknown>) => {
  const message = asRecord(item.message);
  const postback = asRecord(item.postback);
  const referral = asRecord(item.referral);

  return (
    asString(message?.text) ||
    asString(postback?.title) ||
    asString(postback?.payload) ||
    asString(referral?.ref) ||
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
    text: extractSocialText(item),
    mediaUrl: message ? extractAttachmentUrl(message) : null,
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
