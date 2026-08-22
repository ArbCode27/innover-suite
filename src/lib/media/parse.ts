import {
  createMessageAttachment,
  isMessageAttachmentKind,
  type MessageAttachment,
  type MessageAttachmentKind,
  type MessageLocation,
} from "@/lib/media/types";

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const asString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
};

const asNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
};

const asBoolean = (value: unknown): boolean => value === true;

const parseLocation = (value: unknown): MessageLocation | null => {
  const record = asRecord(value);
  if (!record) return null;

  const lat = asNumber(record.lat) ?? asNumber(record.latitude);
  const lng = asNumber(record.lng) ?? asNumber(record.longitude) ?? asNumber(record.long);
  if (lat === null || lng === null) return null;

  return {
    lat,
    lng,
    name: asString(record.name),
    address: asString(record.address),
  };
};

const parseNestedAttachment = (value: unknown): MessageAttachment | null => {
  const record = asRecord(value);
  if (!record || !isMessageAttachmentKind(record.kind)) {
    return null;
  }

  return createMessageAttachment({
    kind: record.kind,
    status:
      record.status === "ready" || record.status === "failed" || record.status === "pending"
        ? record.status
        : "pending",
    storagePath: asString(record.storage_path) ?? asString(record.storagePath),
    mimeType: asString(record.mime_type) ?? asString(record.mimeType),
    fileName: asString(record.file_name) ?? asString(record.fileName),
    sizeBytes: asNumber(record.size_bytes) ?? asNumber(record.sizeBytes),
    durationMs: asNumber(record.duration_ms) ?? asNumber(record.durationMs),
    width: asNumber(record.width),
    height: asNumber(record.height),
    caption: asString(record.caption),
    location: parseLocation(record.location),
    providerMediaId: asString(record.provider_media_id) ?? asString(record.providerMediaId),
    sourceUrl: asString(record.source_url) ?? asString(record.sourceUrl),
    isVoice: asBoolean(record.is_voice) || asBoolean(record.isVoice),
    error: asString(record.error),
  });
};

export const parseMessageAttachment = (metadata: unknown): MessageAttachment | null => {
  const record = asRecord(metadata);
  if (!record) return null;

  const nested = parseNestedAttachment(record.attachment);
  if (nested) return nested;

  const legacyKind = record.attachment_kind;
  if (!isMessageAttachmentKind(legacyKind)) {
    return null;
  }

  return createMessageAttachment({
    kind: legacyKind,
    status: "ready",
    fileName: asString(record.attachment_name),
    sizeBytes: asNumber(record.attachment_size),
    isVoice: asBoolean(record.is_voice),
  });
};

export const serializeMessageAttachment = (attachment: MessageAttachment): Record<string, unknown> => ({
  kind: attachment.kind,
  status: attachment.status,
  storage_path: attachment.storagePath,
  mime_type: attachment.mimeType,
  file_name: attachment.fileName,
  size_bytes: attachment.sizeBytes,
  duration_ms: attachment.durationMs,
  width: attachment.width,
  height: attachment.height,
  caption: attachment.caption,
  location: attachment.location,
  provider_media_id: attachment.providerMediaId,
  source_url: attachment.sourceUrl,
  is_voice: attachment.isVoice,
  error: attachment.error,
});

export const mergeAttachmentMetadata = (
  metadata: Record<string, unknown>,
  attachment: MessageAttachment,
): Record<string, unknown> => ({
  ...metadata,
  attachment: serializeMessageAttachment(attachment),
  attachment_kind: attachment.kind,
  attachment_name: attachment.fileName,
  ...(attachment.sizeBytes !== null ? { attachment_size: attachment.sizeBytes } : {}),
  ...(attachment.isVoice ? { is_voice: true } : {}),
});

export const attachmentPreviewLabel = (kind: MessageAttachmentKind, isVoice = false) => {
  if (kind === "image") return "Foto";
  if (kind === "video") return "Video";
  if (kind === "audio") return isVoice ? "Nota de voz" : "Audio";
  if (kind === "document") return "Documento";
  if (kind === "location") return "Ubicación";
  return "Sticker";
};

export const resolveMessagePreview = (params: {
  content: string | null;
  mediaUrl: string | null;
  metadata: unknown;
}) => {
  const attachment = parseMessageAttachment(params.metadata);
  const content = params.content?.trim() || "";
  if (content) return content;

  if (attachment?.kind === "location") {
    const locationLabel = attachment.location?.name || attachment.location?.address;
    return locationLabel ? `Ubicación · ${locationLabel}` : "Ubicación";
  }

  if (attachment) {
    return attachmentPreviewLabel(attachment.kind, attachment.isVoice);
  }

  if (params.mediaUrl) return "Adjunto multimedia";
  return "Sin mensajes recientes";
};

export const describeAttachmentForAgent = (attachment: MessageAttachment) => {
  const caption = attachment.caption?.trim();
  if (attachment.kind === "location" && attachment.location) {
    const { lat, lng, name, address } = attachment.location;
    const label = [name, address].filter(Boolean).join(" · ");
    return `El contacto compartió una ubicación${label ? `: ${label}` : ""} (${lat}, ${lng}).`;
  }

  if (attachment.kind === "audio") {
    const base = attachment.isVoice ? "El contacto envió una nota de voz." : "El contacto envió un audio.";
    return caption ? `${base} Comentario: ${caption}` : base;
  }

  if (attachment.kind === "image") {
    return caption ? `El contacto envió una imagen. Comentario: ${caption}` : "El contacto envió una imagen.";
  }

  if (attachment.kind === "video") {
    return caption ? `El contacto envió un video. Comentario: ${caption}` : "El contacto envió un video.";
  }

  if (attachment.kind === "sticker") {
    return "El contacto envió un sticker.";
  }

  const fileName = attachment.fileName ? ` (${attachment.fileName})` : "";
  return caption
    ? `El contacto envió un documento${fileName}. Comentario: ${caption}`
    : `El contacto envió un documento${fileName}.`;
};

export const mapsUrlFromLocation = (location: MessageLocation) =>
  `https://www.google.com/maps?q=${encodeURIComponent(`${location.lat},${location.lng}`)}`;
