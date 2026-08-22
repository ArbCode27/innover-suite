import type { GeminiPart } from "@/lib/agent/gemini";
import { describeAttachmentForAgent, parseMessageAttachment } from "@/lib/media/parse";
import { downloadStoredMessageMedia } from "@/lib/media/storage";
import { MAX_GEMINI_INLINE_BYTES, type MessageAttachment } from "@/lib/media/types";

const INLINE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
  "audio/wav",
  "audio/mp3",
  "audio/mpeg",
  "audio/aiff",
  "audio/aac",
  "audio/ogg",
  "audio/flac",
  "application/pdf",
]);

const canInlineAttachment = (attachment: MessageAttachment) => {
  if (attachment.status !== "ready" || !attachment.storagePath) return false;
  if (attachment.kind === "video" || attachment.kind === "location") return false;
  if (attachment.sizeBytes && attachment.sizeBytes > MAX_GEMINI_INLINE_BYTES) return false;

  const mimeType = (attachment.mimeType || "").split(";")[0]?.trim().toLowerCase() ?? "";
  if (attachment.kind === "image" || attachment.kind === "sticker") {
    return !mimeType || INLINE_MIME_TYPES.has(mimeType) || mimeType.startsWith("image/");
  }
  if (attachment.kind === "audio") {
    return !mimeType || INLINE_MIME_TYPES.has(mimeType) || mimeType.startsWith("audio/");
  }
  if (attachment.kind === "document") {
    return mimeType === "application/pdf" || mimeType.startsWith("image/");
  }
  return false;
};

const toBase64 = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64");

export const buildGeminiMessageParts = async (params: {
  content: string | null;
  metadata: unknown;
  includeBinary: boolean;
}): Promise<GeminiPart[]> => {
  const attachment = parseMessageAttachment(params.metadata);
  const parts: GeminiPart[] = [];
  const text = params.content?.trim() || (attachment ? describeAttachmentForAgent(attachment) : "");

  if (text) {
    parts.push({ text });
  }

  if (!params.includeBinary || !attachment || !canInlineAttachment(attachment) || !attachment.storagePath) {
    return parts;
  }

  try {
    const bytes = await downloadStoredMessageMedia(attachment.storagePath);
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_GEMINI_INLINE_BYTES) {
      return parts;
    }

    const mimeType =
      (attachment.mimeType || "").split(";")[0]?.trim() ||
      (attachment.kind === "audio"
        ? "audio/ogg"
        : attachment.kind === "document"
          ? "application/pdf"
          : "image/jpeg");

    parts.push({
      inlineData: {
        mimeType,
        data: toBase64(bytes),
      },
    });
  } catch {
    return parts;
  }

  return parts;
};
