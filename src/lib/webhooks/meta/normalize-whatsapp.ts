import { asArray, asRecord, asString, toIsoTimestamp } from "@/lib/webhooks/meta/json";
import type { InboundMessageEvent } from "@/lib/webhooks/meta/types";

const SKIPPED_MESSAGE_TYPES = new Set(["reaction", "system", "unsupported"]);

const extractMediaUrl = (message: Record<string, unknown>) => {
  const mediaKeys = ["image", "video", "audio", "document", "sticker"] as const;

  for (const key of mediaKeys) {
    const media = asRecord(message[key]);
    const url = asString(media?.url) || asString(media?.link);
    if (url) {
      return url;
    }
  }

  return null;
};

const extractWhatsappText = (message: Record<string, unknown>) => {
  const text = asRecord(message.text);
  const button = asRecord(message.button);
  const interactive = asRecord(message.interactive);
  const buttonReply = asRecord(interactive?.button_reply);
  const listReply = asRecord(interactive?.list_reply);
  const image = asRecord(message.image);
  const video = asRecord(message.video);
  const document = asRecord(message.document);

  return (
    asString(text?.body) ||
    asString(button?.text) ||
    asString(buttonReply?.title) ||
    asString(listReply?.title) ||
    asString(image?.caption) ||
    asString(video?.caption) ||
    asString(document?.caption) ||
    asString(document?.filename) ||
    null
  );
};

const toWhatsappEvent = (
  accountId: string,
  message: Record<string, unknown>,
  namesByWaId: Map<string, string>,
): InboundMessageEvent | null => {
  const type = asString(message.type);
  const externalMessageId = asString(message.id);
  const externalUserId = asString(message.from);

  if (!externalMessageId || !externalUserId || (type && SKIPPED_MESSAGE_TYPES.has(type))) {
    return null;
  }

  return {
    channel: "whatsapp",
    accountId,
    externalMessageId,
    externalUserId,
    displayName: namesByWaId.get(externalUserId) ?? null,
    phone: externalUserId,
    text: extractWhatsappText(message),
    mediaUrl: extractMediaUrl(message),
    timestamp: toIsoTimestamp(message.timestamp),
    rawPayload: message,
  };
};

export const normalizeWhatsappEvents = (payload: unknown): InboundMessageEvent[] => {
  const root = asRecord(payload);
  if (asString(root?.object) !== "whatsapp_business_account") {
    return [];
  }

  return asArray(root?.entry).flatMap((entry) => {
    const entryRecord = asRecord(entry);
    if (!entryRecord) {
      return [];
    }

    return asArray(entryRecord.changes).flatMap((change) => {
      const changeRecord = asRecord(change);
      const value = asRecord(changeRecord?.value);
      if (asString(changeRecord?.field) !== "messages" || !value) {
        return [];
      }

      const metadata = asRecord(value.metadata);
      const accountId = asString(metadata?.phone_number_id);
      if (!accountId) {
        return [];
      }

      const namesByWaId = new Map<string, string>();
      asArray(value.contacts).forEach((contact) => {
        const contactRecord = asRecord(contact);
        const waId = asString(contactRecord?.wa_id);
        const profile = asRecord(contactRecord?.profile);
        const name = asString(profile?.name);
        if (waId && name) {
          namesByWaId.set(waId, name);
        }
      });

      return asArray(value.messages).flatMap((item) => {
        const message = asRecord(item);
        if (!message) {
          return [];
        }

        const event = toWhatsappEvent(accountId, message, namesByWaId);
        return event ? [event] : [];
      });
    });
  });
};
