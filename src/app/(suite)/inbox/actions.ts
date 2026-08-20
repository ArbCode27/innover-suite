"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentMembership, hasOrganizationRole } from "@/lib/organizations/membership";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AttachmentKind, InboxMessage } from "./types";

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
  const metadata =
    row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>) : {};

  const attachmentKindValue = metadata["attachment_kind"];
  const attachmentNameValue = metadata["attachment_name"];

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
    attachmentName: typeof attachmentNameValue === "string" ? attachmentNameValue : null,
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
    .select("id")
    .eq("id", parsed.data.conversationId)
    .eq("organization_id", membership.organizationId)
    .single();

  if (conversationError || !conversation?.id) {
    return { error: "La conversación no existe o no pertenece a tu organización." };
  }

  const now = new Date().toISOString();
  const messageMetadata: Record<string, unknown> = {};
  if (parsed.data.attachmentKind) {
    messageMetadata.attachment_kind = parsed.data.attachmentKind;
  }
  if (parsed.data.attachmentName) {
    messageMetadata.attachment_name = parsed.data.attachmentName;
  }
  if (parsed.data.attachmentSize !== undefined) {
    messageMetadata.attachment_size = parsed.data.attachmentSize;
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
      metadata: messageMetadata,
      created_at: now,
    })
    .select("id, conversation_id, direction, sender_type, content, media_url, metadata, created_at")
    .single();

  if (insertError || !insertedMessage) {
    return { error: insertError?.message || "No se pudo enviar el mensaje." };
  }

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
    return { error: updateError.message || "Mensaje enviado, pero no se pudo actualizar la conversación." };
  }

  revalidatePath("/inbox");
  return {
    success: "Mensaje enviado",
    data: { message: normalizeMessageResult(insertedMessage) },
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
