import { resolveInstagramCredentials } from "@/lib/integrations/instagram-credentials";
import { sendMetaOutboundMessage } from "@/lib/integrations/meta-send";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { MetaChannel } from "@/types/domain";

type ConversationSendContext = {
  id: number;
  channel: MetaChannel;
  contact_id: number | null;
  channel_account_id: number | null;
  customer_phone: string | null;
};

const asMetadata = (value: unknown) =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

const resolveRecipientId = async (organizationId: number, conversation: ConversationSendContext) => {
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

const resolveChannelAccessToken = async (organizationId: number, conversation: ConversationSendContext) => {
  const admin = getSupabaseAdminClient();
  const emptyCredentials = { accountId: null as string | null, accessToken: null as string | null };

  if (conversation.channel === "instagram") {
    const instagramCredentials = await resolveInstagramCredentials({
      organizationId,
      channelAccountId: conversation.channel_account_id,
      supabase: admin,
    });

    if (!instagramCredentials) {
      return emptyCredentials;
    }

    return {
      accountId: instagramCredentials.oauthInstagramUserId || "instagram",
      accessToken: instagramCredentials.accessToken,
    };
  }

  const accountQuery = admin
    .from("channel_accounts")
    .select("external_account_id, access_token")
    .eq("organization_id", organizationId)
    .eq("channel", conversation.channel);

  const { data: account } = conversation.channel_account_id
    ? await accountQuery.eq("id", conversation.channel_account_id).maybeSingle()
    : await accountQuery.limit(1).maybeSingle();

  if (!account?.access_token) {
    return emptyCredentials;
  }

  return {
    accountId: (account.external_account_id as string | null) ?? null,
    accessToken: account.access_token as string,
  };
};

export const insertSystemMessage = async (params: {
  organizationId: number;
  conversationId: number;
  content: string;
}) => {
  const admin = getSupabaseAdminClient();
  const now = new Date().toISOString();
  await admin.from("messages").insert({
    organization_id: params.organizationId,
    conversation_id: params.conversationId,
    direction: "outbound",
    sender_type: "system",
    content: params.content,
    metadata: { source: "agent" },
    created_at: now,
  });
};

export const escalateConversationToHuman = async (params: {
  organizationId: number;
  conversationId: number;
  reason: string;
}) => {
  const admin = getSupabaseAdminClient();
  const now = new Date().toISOString();
  await admin
    .from("conversations")
    .update({
      mode: "human",
      status: "in_progress",
      updated_at: now,
    })
    .eq("id", params.conversationId)
    .eq("organization_id", params.organizationId);

  await insertSystemMessage({
    organizationId: params.organizationId,
    conversationId: params.conversationId,
    content: `Conversación cedida a un asesor. Motivo: ${params.reason}`,
  });
};

export const sendAiOutboundMessage = async (params: {
  organizationId: number;
  conversationId: number;
  text: string;
  metadata?: Record<string, unknown>;
}) => {
  const text = params.text.trim();
  if (!text) {
    return { ok: false as const, error: "El agente no generó texto para enviar." };
  }

  const admin = getSupabaseAdminClient();
  const { data: conversation, error: conversationError } = await admin
    .from("conversations")
    .select("id, channel, contact_id, channel_account_id, customer_phone, mode")
    .eq("id", params.conversationId)
    .eq("organization_id", params.organizationId)
    .maybeSingle();

  if (conversationError || !conversation?.id) {
    return { ok: false as const, error: "La conversación no existe." };
  }

  if (conversation.mode !== "ai") {
    return { ok: false as const, error: "La conversación ya está en modo humano." };
  }

  const typedConversation = conversation as ConversationSendContext;
  const recipientId = await resolveRecipientId(params.organizationId, typedConversation);
  if (!recipientId) {
    return { ok: false as const, error: "No se encontró el destinatario." };
  }

  const channelCredentials = await resolveChannelAccessToken(params.organizationId, typedConversation);
  if (!channelCredentials.accessToken || !channelCredentials.accountId) {
    return { ok: false as const, error: "Falta el token del canal conectado." };
  }

  const now = new Date().toISOString();
  const { data: inserted, error: insertError } = await admin
    .from("messages")
    .insert({
      organization_id: params.organizationId,
      conversation_id: params.conversationId,
      direction: "outbound",
      sender_type: "ai",
      content: text,
      metadata: {
        delivery_status: "pending",
        recipient_id: recipientId,
        channel: typedConversation.channel,
        ...params.metadata,
      },
      created_at: now,
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    return { ok: false as const, error: "No se pudo guardar la respuesta del agente." };
  }

  const outboundResult = await sendMetaOutboundMessage({
    channel: typedConversation.channel,
    accessToken: channelCredentials.accessToken,
    accountId: channelCredentials.accountId,
    recipientId,
    text,
  });

  await admin
    .from("messages")
    .update({
      external_message_id: outboundResult.ok ? outboundResult.externalMessageId : null,
      metadata: {
        delivery_status: outboundResult.ok ? "sent" : "failed",
        recipient_id: recipientId,
        channel: typedConversation.channel,
        ...params.metadata,
        ...(outboundResult.ok ? {} : { delivery_error: outboundResult.errorMessage }),
      },
    })
    .eq("id", inserted.id);

  await admin
    .from("conversations")
    .update({
      updated_at: now,
      last_message_at: now,
    })
    .eq("id", params.conversationId)
    .eq("organization_id", params.organizationId);

  if (!outboundResult.ok) {
    return { ok: false as const, error: outboundResult.errorMessage };
  }

  return { ok: true as const };
};
