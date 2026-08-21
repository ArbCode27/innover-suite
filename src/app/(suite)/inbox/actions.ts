"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sendMetaOutboundMessage } from "@/lib/integrations/meta-send";
import { getCurrentMembership, hasOrganizationRole } from "@/lib/organizations/membership";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { MetaChannel } from "@/types/domain";
import type { AttachmentKind, InboxMessage } from "./types";
import { parseDeliveryStatus } from "./types";

const attachmentKinds = ["image", "video", "audio", "document"] as const;

const sendMessageSchema = z.object({
  conversationId: z.number().int().positive(),
  content: z.string().trim().max(4000).optional(),
  mediaUrl: z.string().trim().url().optional(),
  attachmentKind: z.enum(attachmentKinds).optional(),
  attachmentName: z.string().trim().max(255).optional(),
  attachmentSize: z.number().int().nonnegative().optional(),
});

const conversationActionSchema = z.object({
  conversationId: z.number().int().positive(),
});

type ActionResult<T = undefined> = {
  success?: string;
  error?: string;
  data?: T;
};

type ConversationSendContext = {
  id: number;
  channel: MetaChannel;
  contact_id: number | null;
  channel_account_id: number | null;
  customer_phone: string | null;
};

const asMetadata = (value: unknown) =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

const normalizeMessageResult = (row: {
  id: number;
  conversation_id: number;
  direction: "inbound" | "outbound";
  sender_type: "contact" | "agent" | "ai" | "system";
  content: string | null;
  media_url: string | null;
  metadata: unknown;
  created_at: string;
}): InboxMessage => {
  const metadata = asMetadata(row.metadata);
  const attachmentKindValue = metadata["attachment_kind"];

  return {
    id: row.id,
    conversationId: row.conversation_id,
    direction: row.direction,
    senderType: row.sender_type,
    content: row.content,
    mediaUrl: row.media_url,
    createdAt: row.created_at,
    attachmentKind: (typeof attachmentKindValue === "string" &&
    attachmentKinds.includes(attachmentKindValue as AttachmentKind)
      ? attachmentKindValue
      : null) as AttachmentKind | null,
    attachmentName: typeof metadata["attachment_name"] === "string" ? metadata["attachment_name"] : null,
    deliveryStatus: parseDeliveryStatus(metadata),
  };
};

const resolveRecipientId = async (
  organizationId: number,
  conversation: ConversationSendContext,
) => {
  const admin = getSupabaseAdminClient();

  if (conversation.channel === "whatsapp" && conversation.customer_phone) {
    return conversation.customer_phone.replace(/\D/g, "");
  }

  if (conversation.contact_id) {
    const { data: contactChannel } = await admin
      .from("contact_channels")
      .select("external_id")
      .eq("organization_id", organizationId)
      .eq("contact_id", conversation.contact_id)
      .eq("channel", conversation.channel)
      .maybeSingle();

    if (typeof contactChannel?.external_id === "string" && contactChannel.external_id) {
      return contactChannel.external_id;
    }
  }

  const { data: inboundMessage } = await admin
    .from("messages")
    .select("metadata")
    .eq("organization_id", organizationId)
    .eq("conversation_id", conversation.id)
    .eq("direction", "inbound")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const inboundMetadata = asMetadata(inboundMessage?.metadata);
  return typeof inboundMetadata.externalUserId === "string" ? inboundMetadata.externalUserId : null;
};

const resolveChannelAccessToken = async (
  organizationId: number,
  conversation: ConversationSendContext,
) => {
  const admin = getSupabaseAdminClient();
  const emptyCredentials = { accountId: null as string | null, accessToken: null as string | null };

  const accountQuery = admin
    .from("channel_accounts")
    .select("external_account_id, access_token")
    .eq("organization_id", organizationId)
    .eq("channel", conversation.channel);

  const { data: account } = conversation.channel_account_id
    ? await accountQuery.eq("id", conversation.channel_account_id).maybeSingle()
    : await accountQuery.limit(1).maybeSingle();

  if (!account) {
    return emptyCredentials;
  }

  if (account.access_token) {
    return {
      accountId: (account.external_account_id as string | null) ?? null,
      accessToken: account.access_token as string,
    };
  }

  if (conversation.channel === "instagram") {
    const connectionQuery = admin
      .from("instagram_connections")
      .select("access_token, instagram_user_id")
      .eq("organization_id", organizationId)
      .is("revoked_at", null);

    const { data: connection } = account.external_account_id
      ? await connectionQuery.eq("instagram_user_id", account.external_account_id).maybeSingle()
      : await connectionQuery.limit(1).maybeSingle();

    return {
      accountId:
        (connection?.instagram_user_id as string | undefined) ||
        (account.external_account_id as string | null) ||
        null,
      accessToken: (connection?.access_token as string | undefined) ?? null,
    };
  }

  return {
    accountId: (account.external_account_id as string | null) ?? null,
    accessToken: null,
  };
};

export const sendConversationMessageAction = async (
  rawValues: unknown,
): Promise<ActionResult<{ message: InboxMessage }>> => {
  const parsed = sendMessageSchema.safeParse(rawValues);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos para enviar mensaje." };
  }

  const text = parsed.data.content?.trim() ?? "";
  const hasMedia = Boolean(parsed.data.mediaUrl);
  if (!text && !hasMedia) {
    return { error: "Escribe un mensaje o adjunta un archivo." };
  }

  const membership = await getCurrentMembership();
  if (!membership || !hasOrganizationRole(membership, ["owner", "admin", "agent"])) {
    return { error: "No tienes permisos para responder conversaciones." };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Tu sesión expiró. Inicia sesión nuevamente." };
  }

  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .select("id, channel, contact_id, channel_account_id, customer_phone")
    .eq("id", parsed.data.conversationId)
    .eq("organization_id", membership.organizationId)
    .single();

  if (conversationError || !conversation?.id) {
    return { error: "La conversación no existe o no pertenece a tu organización." };
  }

  const typedConversation = conversation as ConversationSendContext;
  const recipientId = await resolveRecipientId(membership.organizationId, typedConversation);
  if (!recipientId) {
    return { error: "No se encontró el destinatario de esta conversación." };
  }

  const channelCredentials = await resolveChannelAccessToken(membership.organizationId, typedConversation);
  if (!channelCredentials.accessToken || !channelCredentials.accountId) {
    return {
      error: "Falta el token de la cuenta conectada. Vuelve a vincular Instagram o Messenger en Configuración.",
    };
  }

  const now = new Date().toISOString();
  const pendingMetadata: Record<string, unknown> = {
    delivery_status: "pending",
    recipient_id: recipientId,
    channel: typedConversation.channel,
  };
  if (parsed.data.attachmentKind) {
    pendingMetadata.attachment_kind = parsed.data.attachmentKind;
  }
  if (parsed.data.attachmentName) {
    pendingMetadata.attachment_name = parsed.data.attachmentName;
  }
  if (parsed.data.attachmentSize !== undefined) {
    pendingMetadata.attachment_size = parsed.data.attachmentSize;
  }

  const { data: insertedMessage, error: insertError } = await supabase
    .from("messages")
    .insert({
      organization_id: membership.organizationId,
      conversation_id: parsed.data.conversationId,
      direction: "outbound",
      sender_type: "agent",
      sender_user_id: user.id,
      content: text || null,
      media_url: parsed.data.mediaUrl ?? null,
      metadata: pendingMetadata,
      created_at: now,
    })
    .select("id, conversation_id, direction, sender_type, content, media_url, metadata, created_at")
    .single();

  if (insertError || !insertedMessage) {
    return { error: insertError?.message || "No se pudo guardar el mensaje antes de enviarlo." };
  }

  const outboundResult = await sendMetaOutboundMessage({
    channel: typedConversation.channel,
    accessToken: channelCredentials.accessToken,
    accountId: channelCredentials.accountId,
    recipientId,
    text: text || undefined,
    mediaUrl: parsed.data.mediaUrl,
    attachmentKind: parsed.data.attachmentKind,
  });

  const deliveryMetadata = {
    ...pendingMetadata,
    delivery_status: outboundResult.ok ? "sent" : "failed",
    ...(outboundResult.ok ? {} : { delivery_error: outboundResult.errorMessage }),
  };

  const { data: deliveredMessage, error: deliveryUpdateError } = await getSupabaseAdminClient()
    .from("messages")
    .update({
      external_message_id: outboundResult.ok ? outboundResult.externalMessageId : null,
      metadata: deliveryMetadata,
    })
    .eq("id", insertedMessage.id)
    .eq("organization_id", membership.organizationId)
    .select("id, conversation_id, direction, sender_type, content, media_url, metadata, created_at")
    .single();

  const persistedMessage = deliveredMessage ?? {
    ...insertedMessage,
    metadata: deliveryMetadata,
  };

  const { error: updateError } = await supabase
    .from("conversations")
    .update({
      updated_at: now,
      last_message_at: now,
      mode: "human",
      status: "in_progress",
      assigned_user_id: user.id,
      assigned_at: now,
    })
    .eq("id", parsed.data.conversationId)
    .eq("organization_id", membership.organizationId);

  if (updateError) {
    return {
      error: updateError.message || "Mensaje enviado, pero no se pudo actualizar la conversación.",
      data: { message: normalizeMessageResult(persistedMessage) },
    };
  }

  revalidatePath("/inbox");

  if (!outboundResult.ok) {
    return {
      error: outboundResult.errorMessage,
      data: { message: normalizeMessageResult(persistedMessage) },
    };
  }

  if (deliveryUpdateError) {
    return {
      error: "El mensaje se envió, pero no se pudo confirmar el estado de entrega.",
      data: { message: normalizeMessageResult(persistedMessage) },
    };
  }

  return {
    success: "Mensaje enviado",
    data: { message: normalizeMessageResult(persistedMessage) },
  };
};

export const takeConversationAction = async (
  rawValues: unknown,
): Promise<ActionResult> => {
  const parsed = conversationActionSchema.safeParse(rawValues);
  if (!parsed.success) {
    return { error: "La conversación indicada no es válida." };
  }

  const membership = await getCurrentMembership();
  if (!membership || !hasOrganizationRole(membership, ["owner", "admin", "agent"])) {
    return { error: "No tienes permisos para tomar conversaciones." };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Tu sesión expiró. Inicia sesión nuevamente." };
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("conversations")
    .update({
      mode: "human",
      status: "in_progress",
      assigned_user_id: user.id,
      assigned_at: now,
      updated_at: now,
    })
    .eq("id", parsed.data.conversationId)
    .eq("organization_id", membership.organizationId);

  if (error) {
    return { error: error.message || "No se pudo tomar la conversación." };
  }

  revalidatePath("/inbox");
  return { success: "Conversación asignada a tu bandeja." };
};
