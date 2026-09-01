import { resolveMessagePreview } from "@/lib/media/parse";

export const CONVERSATION_PREVIEW_MAX_CHARS = 180;

export type ConversationMessageDirection = "inbound" | "outbound";

type ConversationUpdateResult = {
  error: { message?: string } | null;
};

const clipPreview = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "Sin mensajes recientes";
  return trimmed.slice(0, CONVERSATION_PREVIEW_MAX_CHARS);
};

export const buildMessagePreview = (params: {
  content?: string | null;
  mediaUrl?: string | null;
  metadata?: unknown;
}) =>
  clipPreview(
    resolveMessagePreview({
      content: params.content ?? null,
      mediaUrl: params.mediaUrl ?? null,
      metadata: params.metadata,
    }),
  );

export const buildConversationPreviewPatch = (params: {
  preview: string;
  direction: ConversationMessageDirection;
  at?: string;
  metadata?: Record<string, unknown>;
}) => {
  const preview = clipPreview(params.preview);
  const at = params.at ?? new Date().toISOString();
  const patch: Record<string, unknown> = {
    updated_at: at,
    last_message_at: at,
    last_message_preview: preview,
    last_message_direction: params.direction,
  };

  if (params.metadata) {
    patch.metadata = {
      ...params.metadata,
      last_message_preview: preview,
    };
  }

  return patch;
};

export const updateConversationWithPreview = async (
  run: (patch: Record<string, unknown>) => PromiseLike<ConversationUpdateResult>,
  patch: Record<string, unknown>,
) => {
  const first = await run(patch);
  if (!first.error) {
    return first;
  }

  const message = first.error.message ?? "";
  if (!/last_message_preview|last_message_direction/i.test(message)) {
    return first;
  }

  const fallback = { ...patch };
  delete fallback.last_message_preview;
  delete fallback.last_message_direction;
  return run(fallback);
};
