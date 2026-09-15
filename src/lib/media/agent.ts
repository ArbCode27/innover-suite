import { describeImageWithVision, transcribeAudioWithGroq } from "@/lib/agent/groq";
import { describeAttachmentForAgent, parseMessageAttachment } from "@/lib/media/parse";
import { downloadStoredMessageMedia } from "@/lib/media/storage";
import { MAX_MEDIA_INLINE_BYTES } from "@/lib/media/types";

export const buildAgentMessageContent = async (params: {
  content: string | null;
  metadata: unknown;
  transcribeAudio: boolean;
}): Promise<string> => {
  const attachment = parseMessageAttachment(params.metadata);
  const text = params.content?.trim() || "";

  if (!attachment) {
    return text;
  }

  if (
    params.transcribeAudio &&
    attachment.kind === "audio" &&
    attachment.status === "ready" &&
    attachment.storagePath
  ) {
    try {
      const bytes = await downloadStoredMessageMedia(attachment.storagePath);
      if (bytes.byteLength > 0 && bytes.byteLength <= MAX_MEDIA_INLINE_BYTES) {
        const transcription = await transcribeAudioWithGroq({
          bytes,
          mimeType: attachment.mimeType ?? undefined,
          fileName: attachment.fileName ?? undefined,
        });

        if (transcription) {
          const prefix = attachment.isVoice
            ? `[Nota de voz del cliente transcrita]: "${transcription}"`
            : `[Audio del cliente transcrito]: "${transcription}"`;
          return text ? `${text}\n${prefix}` : prefix;
        }
      }
    } catch (error) {
      console.warn("[AGENT_MEDIA] Fallback to attachment description after transcription failure:", error);
    }
  }

  if (
    attachment.kind === "image" &&
    attachment.status === "ready" &&
    attachment.storagePath
  ) {
    try {
      const bytes = await downloadStoredMessageMedia(attachment.storagePath);
      if (bytes.byteLength > 0 && bytes.byteLength <= MAX_MEDIA_INLINE_BYTES) {
        const imageDescription = await describeImageWithVision({
          bytes,
          mimeType: attachment.mimeType ?? undefined,
        });

        if (imageDescription) {
          const prefix = `[Imagen enviada por el cliente analizada]: "${imageDescription}"`;
          return text ? `${text}\n${prefix}` : prefix;
        }
      }
    } catch (error) {
      console.warn("[AGENT_MEDIA] Fallback to attachment description after image vision failure:", error);
    }
  }

  const description = describeAttachmentForAgent(attachment);
  if (!text) return description;
  return `${text}\n${description}`;
};
