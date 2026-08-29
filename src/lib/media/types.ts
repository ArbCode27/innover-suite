export const MESSAGE_ATTACHMENT_KINDS = [
  "image",
  "video",
  "audio",
  "document",
  "location",
  "sticker",
] as const;

export type MessageAttachmentKind = (typeof MESSAGE_ATTACHMENT_KINDS)[number];
export type MessageAttachmentStatus = "pending" | "ready" | "failed";

export type MessageLocation = {
  lat: number;
  lng: number;
  name: string | null;
  address: string | null;
};

export type MessageAttachment = {
  kind: MessageAttachmentKind;
  status: MessageAttachmentStatus;
  storagePath: string | null;
  mimeType: string | null;
  fileName: string | null;
  sizeBytes: number | null;
  durationMs: number | null;
  width: number | null;
  height: number | null;
  caption: string | null;
  location: MessageLocation | null;
  providerMediaId: string | null;
  sourceUrl: string | null;
  isVoice: boolean;
  error: string | null;
};

export const MESSAGE_ATTACHMENTS_BUCKET = "message-attachments";
export const MAX_INBOUND_MEDIA_BYTES = 20 * 1024 * 1024;
export const MAX_KNOWLEDGE_IMAGE_BYTES = 5 * 1024 * 1024;
export const KNOWLEDGE_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_GEMINI_INLINE_BYTES = 4 * 1024 * 1024;
export const FACEBOOK_GRAPH_VERSION = "v26.0";

export const isMessageAttachmentKind = (value: unknown): value is MessageAttachmentKind =>
  typeof value === "string" && MESSAGE_ATTACHMENT_KINDS.includes(value as MessageAttachmentKind);

export const createMessageAttachment = (
  partial: Pick<MessageAttachment, "kind"> & Partial<MessageAttachment>,
): MessageAttachment => ({
  kind: partial.kind,
  status: partial.status ?? "pending",
  storagePath: partial.storagePath ?? null,
  mimeType: partial.mimeType ?? null,
  fileName: partial.fileName ?? null,
  sizeBytes: partial.sizeBytes ?? null,
  durationMs: partial.durationMs ?? null,
  width: partial.width ?? null,
  height: partial.height ?? null,
  caption: partial.caption ?? null,
  location: partial.location ?? null,
  providerMediaId: partial.providerMediaId ?? null,
  sourceUrl: partial.sourceUrl ?? null,
  isVoice: partial.isVoice ?? false,
  error: partial.error ?? null,
});
