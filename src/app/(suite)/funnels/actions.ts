"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { loadFunnelBoard } from "@/lib/funnels/board";
import { getCurrentMembership, hasOrganizationRole } from "@/lib/organizations/membership";
import { loadOrganizationCurrencies, resolveOrganizationCurrency } from "@/lib/organizations/currencies";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sessionExpiredResult } from "@/lib/auth/session-result";
import type { FunnelCardView } from "./types";

const POSTGRES_UNIQUE_VIOLATION = "23505";

const createCardSchema = z.object({
  contactId: z.number().int().positive(),
  stageId: z.number().int().positive(),
  title: z.string().trim().min(1).max(120),
  valueAmount: z.number().nonnegative().max(1_000_000_000).optional(),
  currency: z.string().trim().length(3).optional(),
  conversationId: z.number().int().positive().optional(),
});

const moveCardSchema = z.object({
  cardId: z.number().int().positive(),
  stageId: z.number().int().positive(),
  position: z.number().int().nonnegative(),
});

const conversationCardSchema = z.object({
  conversationId: z.number().int().positive(),
});

type ActionResult<T = undefined> = {
  success?: string;
  error?: string;
  data?: T;
};

const isUniqueViolation = (error: { code?: string } | null) => error?.code === POSTGRES_UNIQUE_VIOLATION;

const requireAgentMembership = async () => {
  const membership = await getCurrentMembership();
  if (!membership || !hasOrganizationRole(membership, ["owner", "admin", "agent"])) {
    return { error: "No tienes permisos para gestionar el embudo." } as const;
  }

  return { membership } as const;
};

const nextStagePosition = async (stageId: number, organizationId: number) => {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("funnel_cards")
    .select("position")
    .eq("organization_id", organizationId)
    .eq("stage_id", stageId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  return typeof data?.position === "number" ? data.position + 1 : 0;
};

const loadStageContext = async (stageId: number, organizationId: number) => {
  const supabase = await createSupabaseServerClient();
  const { data: stage, error } = await supabase
    .from("funnel_stages")
    .select("id, funnel_id, funnels!inner(organization_id)")
    .eq("id", stageId)
    .maybeSingle();

  if (error || !stage?.id) {
    return null;
  }

  const funnel = Array.isArray(stage.funnels) ? stage.funnels[0] : stage.funnels;
  if (!funnel || funnel.organization_id !== organizationId) {
    return null;
  }

  return {
    stageId: stage.id as number,
    funnelId: stage.funnel_id as number,
  };
};

export const createFunnelCardAction = async (
  rawValues: unknown,
): Promise<ActionResult<{ card: FunnelCardView }>> => {
  const parsed = createCardSchema.safeParse(rawValues);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos para crear la oportunidad." };
  }

  const access = await requireAgentMembership();
  if ("error" in access) {
    return { error: access.error };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return sessionExpiredResult();
  }

  const stageContext = await loadStageContext(parsed.data.stageId, access.membership.organizationId);
  if (!stageContext) {
    return { error: "La etapa no pertenece a tu organización." };
  }

  const { data: contact, error: contactError } = await supabase
    .from("contacts")
    .select("id, full_name")
    .eq("id", parsed.data.contactId)
    .eq("organization_id", access.membership.organizationId)
    .maybeSingle();

  if (contactError || !contact?.id) {
    return { error: "El contacto no existe o no pertenece a tu organización." };
  }

  let conversationId = parsed.data.conversationId ?? null;
  if (conversationId) {
    const { data: conversation } = await supabase
      .from("conversations")
      .select("id, contact_id")
      .eq("id", conversationId)
      .eq("organization_id", access.membership.organizationId)
      .maybeSingle();

    if (!conversation?.id || conversation.contact_id !== contact.id) {
      conversationId = null;
    }
  }

  const position = await nextStagePosition(stageContext.stageId, access.membership.organizationId);
  const orgCurrencies = await loadOrganizationCurrencies(supabase, access.membership.organizationId);
  const currency = parsed.data.valueAmount
    ? resolveOrganizationCurrency(parsed.data.currency, orgCurrencies)
    : null;
  const insertPayload = {
    organization_id: access.membership.organizationId,
    funnel_id: stageContext.funnelId,
    stage_id: stageContext.stageId,
    contact_id: contact.id,
    conversation_id: conversationId,
    title: parsed.data.title,
    value_amount: parsed.data.valueAmount ?? null,
    currency,
    owner_user_id: user.id,
    position,
  };
  const cardSelect =
    "id, stage_id, contact_id, conversation_id, title, value_amount, currency, owner_user_id, position, updated_at, contacts(full_name, phone), conversations(channel)";
  let { data: inserted, error: insertError } = await supabase
    .from("funnel_cards")
    .insert(insertPayload)
    .select(cardSelect)
    .single();

  if (insertError) {
    if (isUniqueViolation(insertError)) {
      return { error: "Este contacto ya está en el embudo." };
    }
    const fallback = await supabase
      .from("funnel_cards")
      .insert({
        organization_id: insertPayload.organization_id,
        funnel_id: insertPayload.funnel_id,
        stage_id: insertPayload.stage_id,
        contact_id: insertPayload.contact_id,
        conversation_id: insertPayload.conversation_id,
        title: insertPayload.title,
        value_amount: insertPayload.value_amount,
        owner_user_id: insertPayload.owner_user_id,
        position: insertPayload.position,
      })
      .select(
        "id, stage_id, contact_id, conversation_id, title, value_amount, owner_user_id, position, updated_at, contacts(full_name, phone), conversations(channel)",
      )
      .single();
    inserted = fallback.data
      ? { ...fallback.data, currency: currency ?? null }
      : fallback.data;
    insertError = fallback.error;
  }

  if (insertError || !inserted) {
    if (isUniqueViolation(insertError)) {
      return { error: "Este contacto ya está en el embudo." };
    }

    return { error: insertError?.message || "No se pudo crear la oportunidad." };
  }

  revalidatePath("/funnels");
  return {
    success: "Oportunidad creada",
    data: {
      card: {
        id: inserted.id,
        stageId: inserted.stage_id,
        contactId: inserted.contact_id,
        conversationId: inserted.conversation_id,
        title: inserted.title,
        valueAmount: inserted.value_amount === null ? null : Number(inserted.value_amount),
        currency: ((inserted as { currency?: string | null }).currency as string | null) ?? currency,
        ownerUserId: inserted.owner_user_id,
        position: inserted.position,
        updatedAt: inserted.updated_at,
        contactName: (inserted.contacts as { full_name?: string } | null)?.full_name || inserted.title,
        contactPhone: (inserted.contacts as { phone?: string | null } | null)?.phone ?? null,
        channel: (inserted.conversations as { channel?: FunnelCardView["channel"] } | null)?.channel ?? null,
      },
    },
  };
};

export const moveFunnelCardAction = async (rawValues: unknown): Promise<ActionResult> => {
  const parsed = moveCardSchema.safeParse(rawValues);
  if (!parsed.success) {
    return { error: "El movimiento del tablero no es válido." };
  }

  const access = await requireAgentMembership();
  if ("error" in access) {
    return { error: access.error };
  }

  const stageContext = await loadStageContext(parsed.data.stageId, access.membership.organizationId);
  if (!stageContext) {
    return { error: "La etapa destino no pertenece a tu organización." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("funnel_cards")
    .update({
      stage_id: stageContext.stageId,
      funnel_id: stageContext.funnelId,
      position: parsed.data.position,
    })
    .eq("id", parsed.data.cardId)
    .eq("organization_id", access.membership.organizationId);

  if (error) {
    return { error: error.message || "No se pudo mover la oportunidad." };
  }

  revalidatePath("/funnels");
  return { success: "Oportunidad movida" };
};

export const createFunnelCardFromConversationAction = async (
  rawValues: unknown,
): Promise<ActionResult<{ card: FunnelCardView }>> => {
  const parsed = conversationCardSchema.safeParse(rawValues);
  if (!parsed.success) {
    return { error: "La conversación indicada no es válida." };
  }

  const access = await requireAgentMembership();
  if ("error" in access) {
    return { error: access.error };
  }

  const supabase = await createSupabaseServerClient();
  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .select("id, contact_id, contacts(full_name)")
    .eq("id", parsed.data.conversationId)
    .eq("organization_id", access.membership.organizationId)
    .maybeSingle();

  if (conversationError || !conversation?.id || !conversation.contact_id) {
    return { error: "La conversación no tiene un contacto asociado." };
  }

  const board = await loadFunnelBoard(supabase, access.membership.organizationId);
  const firstStage = board.stages[0];
  if (!firstStage) {
    return { error: "El embudo no tiene etapas configuradas." };
  }

  const contactNameRaw = conversation.contacts as { full_name?: string } | { full_name?: string }[] | null;
  const contactName = Array.isArray(contactNameRaw)
    ? contactNameRaw[0]?.full_name
    : contactNameRaw?.full_name;

  return createFunnelCardAction({
    contactId: conversation.contact_id,
    stageId: firstStage.id,
    title: contactName?.trim() || "Oportunidad",
    conversationId: conversation.id,
  });
};
