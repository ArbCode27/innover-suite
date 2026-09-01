"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { resolveInstagramCredentials } from "@/lib/integrations/instagram-credentials";
import { sendMetaOutboundMessage } from "@/lib/integrations/meta-send";
import { createMessageAttachment } from "@/lib/media/types";
import { mergeAttachmentMetadata } from "@/lib/media/parse";
import {
  buildConversationPreviewPatch,
  buildMessagePreview,
  updateConversationWithPreview,
} from "@/lib/inbox/conversation-preview";
import { getCurrentMembership, hasOrganizationRole } from "@/lib/organizations/membership";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sessionExpiredResult } from "@/lib/auth/session-result";
import { zodErrorMessage } from "@/lib/validation/zod-es";
import type { MetaChannel } from "@/types/domain";
import type { FileAttachmentKind, InboxMessage } from "./types";
import { normalizeInboxMessage } from "./types";

const attachmentKinds = ["image", "video", "audio", "document"] as const;

const sendMessageSchema = z.object({
  conversationId: z.number().int().positive(),
  content: z.string().trim().max(4000).optional(),
  mediaUrl: z.string().trim().url().optional(),
  attachmentKind: z.enum(attachmentKinds).optional(),
  attachmentName: z.string().trim().max(255).optional(),
  attachmentSize: z.number().int().nonnegative().optional(),
  isVoice: z.boolean().optional(),
  location: z
    .object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
      name: z.string().trim().max(120).optional(),
      address: z.string().trim().max(255).optional(),
    })
    .optional(),
});

const setConversationModeSchema = z.object({
  conversationId: z.number().int().positive(),
  mode: z.enum(["ai", "human"]),
});

type ActionResult<T = undefined> = {
  success?: string;
  error?: string;
  code?: string;
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
}): InboxMessage => normalizeInboxMessage(row);

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

export const sendConversationMessageAction = async (
  rawValues: unknown,
): Promise<ActionResult<{ message: InboxMessage }>> => {
  const parsed = sendMessageSchema.safeParse(rawValues);
  if (!parsed.success) {
    return { error: zodErrorMessage(parsed.error, "Datos inválidos para enviar mensaje.") };
  }

  const text = parsed.data.content?.trim() ?? "";
  const hasMedia = Boolean(parsed.data.mediaUrl);
  const hasLocation = Boolean(parsed.data.location);
  if (!text && !hasMedia && !hasLocation) {
    return { error: "Escribe un mensaje, adjunta un archivo o comparte una ubicación." };
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
    return sessionExpiredResult();
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
  let pendingMetadata: Record<string, unknown> = {
    delivery_status: "pending",
    recipient_id: recipientId,
    channel: typedConversation.channel,
  };

  if (parsed.data.location) {
    pendingMetadata = mergeAttachmentMetadata(
      pendingMetadata,
      createMessageAttachment({
        kind: "location",
        status: "ready",
        location: {
          lat: parsed.data.location.lat,
          lng: parsed.data.location.lng,
          name: parsed.data.location.name ?? null,
          address: parsed.data.location.address ?? null,
        },
      }),
    );
  } else if (parsed.data.attachmentKind) {
    pendingMetadata = mergeAttachmentMetadata(
      pendingMetadata,
      createMessageAttachment({
        kind: parsed.data.attachmentKind,
        status: "ready",
        fileName: parsed.data.attachmentName ?? null,
        sizeBytes: parsed.data.attachmentSize ?? null,
        sourceUrl: parsed.data.mediaUrl ?? null,
        isVoice: parsed.data.isVoice ?? false,
      }),
    );
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
    attachmentKind: parsed.data.attachmentKind as FileAttachmentKind | undefined,
    location: parsed.data.location
      ? {
          lat: parsed.data.location.lat,
          lng: parsed.data.location.lng,
          name: parsed.data.location.name ?? null,
          address: parsed.data.location.address ?? null,
        }
      : undefined,
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

  const { error: updateError } = await updateConversationWithPreview(
    (patch) =>
      supabase
        .from("conversations")
        .update(patch)
        .eq("id", parsed.data.conversationId)
        .eq("organization_id", membership.organizationId),
    {
      ...buildConversationPreviewPatch({
        preview: buildMessagePreview({
          content: text || null,
          mediaUrl: parsed.data.mediaUrl ?? null,
          metadata: deliveryMetadata,
        }),
        direction: "outbound",
        at: now,
      }),
      status: "in_progress",
      assigned_user_id: user.id,
      assigned_at: now,
    },
  );

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

export const setConversationModeAction = async (
  rawValues: unknown,
): Promise<ActionResult> => {
  const parsed = setConversationModeSchema.safeParse(rawValues);
  if (!parsed.success) {
    return { error: "La conversación o el modo indicado no son válidos." };
  }

  const membership = await getCurrentMembership();
  if (!membership || !hasOrganizationRole(membership, ["owner", "admin", "agent"])) {
    return { error: "No tienes permisos para cambiar el modo de la conversación." };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return sessionExpiredResult();
  }

  const now = new Date().toISOString();
  const nextMode = parsed.data.mode;
  const { error } = await supabase
    .from("conversations")
    .update(
      nextMode === "human"
        ? {
            mode: "human",
            status: "in_progress",
            assigned_user_id: user.id,
            assigned_at: now,
            updated_at: now,
          }
        : {
            mode: "ai",
            assigned_user_id: null,
            assigned_at: null,
            updated_at: now,
          },
    )
    .eq("id", parsed.data.conversationId)
    .eq("organization_id", membership.organizationId);

  if (error) {
    return { error: error.message || "No se pudo actualizar el modo de la conversación." };
  }

  revalidatePath("/inbox");
  return {
    success:
      nextMode === "human"
        ? "Conversación tomada. El agente IA está detenido."
        : "Agente IA reactivado en esta conversación.",
  };
};

export const assignConversationAction = async (rawValues: unknown): Promise<ActionResult> => {
  const parsed = z
    .object({
      conversationId: z.number().int().positive(),
      assignToMe: z.boolean(),
    })
    .safeParse(rawValues);
  if (!parsed.success) {
    return { error: "La conversación no es válida." };
  }

  const membership = await getCurrentMembership();
  if (!membership || !hasOrganizationRole(membership, ["owner", "admin", "agent"])) {
    return { error: "No tienes permisos para asignar conversaciones." };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return sessionExpiredResult();
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("conversations")
    .update(
      parsed.data.assignToMe
        ? { assigned_user_id: user.id, assigned_at: now, mode: "human", status: "in_progress", updated_at: now }
        : { assigned_user_id: null, assigned_at: null, updated_at: now },
    )
    .eq("id", parsed.data.conversationId)
    .eq("organization_id", membership.organizationId);

  if (error) {
    return { error: error.message || "No se pudo actualizar la asignación." };
  }

  revalidatePath("/inbox");
  return { success: parsed.data.assignToMe ? "Conversación asignada a ti." : "Conversación liberada." };
};

export const markConversationReadAction = async (conversationId: number): Promise<ActionResult> => {
  if (!Number.isInteger(conversationId) || conversationId <= 0) {
    return { error: "La conversación no es válida." };
  }

  const membership = await getCurrentMembership();
  if (!membership || !hasOrganizationRole(membership, ["owner", "admin", "agent"])) {
    return { error: "No tienes permisos para actualizar conversaciones." };
  }

  const supabase = await createSupabaseServerClient();
  const { data: conversation, error: fetchError } = await supabase
    .from("conversations")
    .select("metadata")
    .eq("id", conversationId)
    .eq("organization_id", membership.organizationId)
    .maybeSingle();

  if (fetchError || !conversation) {
    return { error: fetchError?.message || "La conversación no existe." };
  }

  const metadata =
    conversation.metadata && typeof conversation.metadata === "object"
      ? { ...(conversation.metadata as Record<string, unknown>), unread_count: 0 }
      : { unread_count: 0 };

  const { error } = await supabase
    .from("conversations")
    .update({ metadata })
    .eq("id", conversationId)
    .eq("organization_id", membership.organizationId);

  if (error) {
    return { error: error.message || "No se pudo marcar la conversación como leída." };
  }

  return { success: "Conversación leída." };
};

export const deleteConversationAction = async (rawValues: unknown): Promise<ActionResult> => {
  const parsed = z.object({ conversationId: z.number().int().positive() }).safeParse(rawValues);
  if (!parsed.success) {
    return { error: "La conversación no es válida." };
  }

  const membership = await getCurrentMembership();
  if (!membership || !hasOrganizationRole(membership, ["owner", "admin", "agent"])) {
    return { error: "No tienes permisos para borrar conversaciones." };
  }

  const supabase = await createSupabaseServerClient();
  const { data: conversation, error: fetchError } = await supabase
    .from("conversations")
    .select("id")
    .eq("id", parsed.data.conversationId)
    .eq("organization_id", membership.organizationId)
    .maybeSingle();

  if (fetchError || !conversation?.id) {
    return { error: fetchError?.message || "La conversación no existe." };
  }

  const admin = getSupabaseAdminClient();
  const { error: messagesError } = await admin
    .from("messages")
    .delete()
    .eq("conversation_id", parsed.data.conversationId)
    .eq("organization_id", membership.organizationId);

  if (messagesError) {
    return { error: messagesError.message || "No se pudieron borrar los mensajes." };
  }

  const { error: conversationError } = await admin
    .from("conversations")
    .delete()
    .eq("id", parsed.data.conversationId)
    .eq("organization_id", membership.organizationId);

  if (conversationError) {
    return { error: conversationError.message || "No se pudo borrar el chat." };
  }

  revalidatePath("/inbox");
  revalidatePath("/home");
  return { success: "Chat borrado." };
};


