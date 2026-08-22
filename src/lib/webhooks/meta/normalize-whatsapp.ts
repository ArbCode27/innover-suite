import { createMessageAttachment, type MessageAttachment, type MessageAttachmentKind } from "@/lib/media/types";
import { asArray, asNumber, asRecord, asString, toIsoTimestamp } from "@/lib/webhooks/meta/json";
import type { InboundMessageEvent } from "@/lib/webhooks/meta/types";

const SKIPPED_MESSAGE_TYPES = new Set(["reaction", "system", "unsupported"]);

const MEDIA_KIND_BY_TYPE: Record<string, MessageAttachmentKind> = {
  image: "image",
  video: "video",
  audio: "audio",
  document: "document",
  sticker: "sticker",
  location: "location",
};

const extractWhatsappAttachment = (message: Record<string, unknown>): MessageAttachment | null => {
  const type = asString(message.type);
  if (!type) return null;

  if (type === "location") {
    const location = asRecord(message.location);
    const lat = asNumber(location?.latitude);
    const lng = asNumber(location?.longitude);
    if (lat === null || lng === null) return null;

    return createMessageAttachment({
      kind: "location",
      status: "ready",
      location: {
        lat,
        lng,
        name: asString(location?.name),
        address: asString(location?.address),
      },
    });
  }

  const kind = MEDIA_KIND_BY_TYPE[type];
  if (!kind || kind === "location") return null;

  const media = asRecord(message[type]);
  if (!media) return null;

  const caption = asString(media.caption);
  const fileName = asString(media.filename) ?? asString(media.name);
  const mimeType = asString(media.mime_type);
  const providerMediaId = asString(media.id);
  const sourceUrl = asString(media.url) ?? asString(media.link);
  const isVoice = media.voice === true;

  if (!providerMediaId && !sourceUrl) {
    return null;
  }

  return createMessageAttachment({
    kind,
    status: "pending",
    caption,
    fileName,
    mimeType,
    providerMediaId,
    sourceUrl,
    isVoice: kind === "audio" ? isVoice : false,
  });
};

const extractWhatsappText = (message: Record<string, unknown>, attachment: MessageAttachment | null) => {
  const text = asRecord(message.text);
  const button = asRecord(message.button);
  const interactive = asRecord(message.interactive);
  const buttonReply = asRecord(interactive?.button_reply);
  const listReply = asRecord(interactive?.list_reply);

  return (
    asString(text?.body) ||
    asString(button?.text) ||
    asString(buttonReply?.title) ||
    asString(listReply?.title) ||
    attachment?.caption ||
    (attachment?.kind === "location"
      ? attachment.location?.name || attachment.location?.address || null
      : null) ||
    attachment?.fileName ||
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

  const attachment = extractWhatsappAttachment(message);

  return {
    channel: "whatsapp",
    accountId,
    externalMessageId,
    externalUserId,
    displayName: namesByWaId.get(externalUserId) ?? null,
    phone: externalUserId,
    text: extractWhatsappText(message, attachment),
    mediaUrl: attachment?.sourceUrl ?? null,
    attachment,
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
