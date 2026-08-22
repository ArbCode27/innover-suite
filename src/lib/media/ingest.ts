import { resolveInstagramCredentials } from "@/lib/integrations/instagram-credentials";
import { downloadMediaFromUrl, resolveWhatsappMediaUrl } from "@/lib/media/download";
import { mergeAttachmentMetadata, parseMessageAttachment } from "@/lib/media/parse";
import { buildMessageStoragePath, uploadMessageMedia } from "@/lib/media/storage";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { logMetaWebhook } from "@/lib/webhooks/meta/logger";
import type { MetaChannel } from "@/types/domain";

export type MediaIngestJob = {
  organizationId: number;
  conversationId: number;
  inboundMessageId: number;
};

type MessageIngestRow = {
  id: number;
  conversation_id: number;
  media_url: string | null;
  metadata: unknown;
  conversations:
    | {
        channel: MetaChannel;
        channel_account_id: number | null;
      }
    | {
        channel: MetaChannel;
        channel_account_id: number | null;
      }[]
    | null;
};

const asMetadata = (value: unknown) =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

const unwrapConversation = (value: MessageIngestRow["conversations"]) => {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
};

const resolveAccessToken = async (params: {
  organizationId: number;
  channel: MetaChannel;
  channelAccountId: number | null;
}) => {
  const admin = getSupabaseAdminClient();

  if (params.channel === "instagram") {
    const credentials = await resolveInstagramCredentials({
      organizationId: params.organizationId,
      channelAccountId: params.channelAccountId,
      supabase: admin,
    });
    return credentials?.accessToken ?? null;
  }

  const query = admin
    .from("channel_accounts")
    .select("access_token")
    .eq("organization_id", params.organizationId)
    .eq("channel", params.channel);

  const { data } = params.channelAccountId
    ? await query.eq("id", params.channelAccountId).maybeSingle()
    : await query.limit(1).maybeSingle();

  return typeof data?.access_token === "string" ? data.access_token : null;
};

const ingestOneMessage = async (job: MediaIngestJob) => {
  const admin = getSupabaseAdminClient();
  const { data: message, error } = await admin
    .from("messages")
    .select("id, conversation_id, media_url, metadata, conversations(channel, channel_account_id)")
    .eq("id", job.inboundMessageId)
    .eq("organization_id", job.organizationId)
    .maybeSingle();

  if (error || !message?.id) {
    throw error || new Error("No se encontró el mensaje para ingerir.");
  }

  const typedMessage = message as MessageIngestRow;
  const attachment = parseMessageAttachment(typedMessage.metadata);
  if (!attachment || attachment.kind === "location" || attachment.status === "ready") {
    return;
  }

  const conversation = unwrapConversation(typedMessage.conversations);
  const accessToken = conversation
    ? await resolveAccessToken({
        organizationId: job.organizationId,
        channel: conversation.channel,
        channelAccountId: conversation.channel_account_id,
      })
    : null;

  try {
    let downloadUrl = attachment.sourceUrl;
    let mimeType = attachment.mimeType;

    if (attachment.providerMediaId) {
      if (!accessToken) {
        throw new Error("Falta el token para descargar el archivo de WhatsApp.");
      }
      const resolved = await resolveWhatsappMediaUrl(attachment.providerMediaId, accessToken);
      downloadUrl = resolved.url;
      mimeType = mimeType || resolved.mimeType;
    }

    if (!downloadUrl) {
      throw new Error("El adjunto no tiene URL ni media id.");
    }

    const downloaded = await downloadMediaFromUrl(downloadUrl, accessToken);
    const fileName = attachment.fileName || downloaded.fileName;
    const path = buildMessageStoragePath({
      organizationId: job.organizationId,
      conversationId: job.conversationId,
      messageId: job.inboundMessageId,
      fileName,
    });
    const publicUrl = await uploadMessageMedia({
      path,
      bytes: downloaded.bytes,
      mimeType: downloaded.mimeType || mimeType,
    });

    const nextAttachment = {
      ...attachment,
      status: "ready" as const,
      storagePath: path,
      mimeType: downloaded.mimeType || mimeType,
      fileName,
      sizeBytes: downloaded.sizeBytes,
      sourceUrl: null,
      error: null,
    };

    const { error: updateError } = await admin
      .from("messages")
      .update({
        media_url: publicUrl,
        metadata: mergeAttachmentMetadata(asMetadata(typedMessage.metadata), nextAttachment),
      })
      .eq("id", job.inboundMessageId)
      .eq("organization_id", job.organizationId);

    if (updateError) {
      throw updateError;
    }
  } catch (caught) {
    const messageText = caught instanceof Error ? caught.message : "No se pudo procesar el archivo.";
    const failedAttachment = {
      ...attachment,
      status: "failed" as const,
      error: messageText,
    };

    await admin
      .from("messages")
      .update({
        metadata: mergeAttachmentMetadata(asMetadata(typedMessage.metadata), failedAttachment),
      })
      .eq("id", job.inboundMessageId)
      .eq("organization_id", job.organizationId);

    logMetaWebhook("warn", "media.ingest_failed", {
      organizationId: job.organizationId,
      conversationId: job.conversationId,
      inboundMessageId: job.inboundMessageId,
      error: messageText,
    });
  }
};

export const ingestInboundMediaJobs = async (jobs: MediaIngestJob[]) => {
  for (const job of jobs) {
    try {
      await ingestOneMessage(job);
    } catch (error) {
      logMetaWebhook("error", "media.ingest_job_failed", {
        organizationId: job.organizationId,
        conversationId: job.conversationId,
        inboundMessageId: job.inboundMessageId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
};
