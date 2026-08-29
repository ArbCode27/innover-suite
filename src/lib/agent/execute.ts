import { createChatAppointment } from "@/lib/calendar/agent";
import { cancelCommerceOrderForAgent, createCommerceOrderForAgent } from "@/lib/commerce/agent";
import { formatMoney, isFulfillmentType } from "@/lib/commerce/types";
import { moveContactToFunnelStage } from "@/lib/funnels/agent";
import { insertSystemMessage } from "@/lib/inbox/agent-outbound";
import type { OrganizationModules } from "@/lib/modules/constants";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { AGENT_MAX_IMAGES_PER_TURN } from "@/lib/agent/constants";
import { areAdvisorsAvailable } from "@/lib/agent/hours";
import type { AgentSettings } from "@/lib/agent/types";
import {
  cancelOrderArgsSchema,
  createAppointmentArgsSchema,
  createOrderArgsSchema,
  handoffToHumanArgsSchema,
  moveContactToStageArgsSchema,
  sendImageArgsSchema,
} from "@/lib/agent/tools";
import { formatTime } from "@/lib/calendar/range";

type AgentQueuedImage = {
  mediaUrl: string;
  caption: string | null;
};

type ToolContext = {
  organizationId: number;
  conversationId: number;
  contactId: number;
  turnId: number;
  channel: string;
  lastInboundText: string;
  settings: AgentSettings;
  modules: OrganizationModules;
  imagesSentThisTurn: { count: number };
};

export const isCustomerConfirmationText = (value: string) => {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return false;
  return /^(confirmar|confirmo|sí|si|ok|dale|listo|va)([.!¡? ]|$)/i.test(normalized) || /\bconfirm(o|ar)\b/i.test(normalized);
};

const logToolRun = async (
  context: ToolContext,
  toolName: string,
  args: unknown,
  result: Record<string, unknown>,
  ok: boolean,
) => {
  const admin = getSupabaseAdminClient();
  await admin.from("agent_tool_runs").insert({
    organization_id: context.organizationId,
    conversation_id: context.conversationId,
    turn_id: context.turnId,
    tool_name: toolName,
    arguments: args ?? {},
    result,
    ok,
  });
};

export const executeAgentTool = async (
  context: ToolContext,
  name: string,
  rawArgs: Record<string, unknown>,
): Promise<{ ok: boolean; result: Record<string, unknown>; handoff?: boolean; image?: AgentQueuedImage }> => {
  if (name === "create_appointment") {
    if (!context.settings.toolsCalendar || !context.modules.calendar) {
      const result = { error: "La herramienta de calendario está desactivada." };
      await logToolRun(context, name, rawArgs, result, false);
      return { ok: false, result };
    }

    const parsed = createAppointmentArgsSchema.safeParse(rawArgs);
    if (!parsed.success) {
      const result = { error: parsed.error.issues[0]?.message ?? "Argumentos inválidos para crear la cita." };
      await logToolRun(context, name, rawArgs, result, false);
      return { ok: false, result };
    }

    if (context.settings.requireBookingConfirmation && !parsed.data.confirmedByCustomer) {
      const result = { error: "El cliente aún no confirmó el horario. Pregunta y espera confirmación." };
      await logToolRun(context, name, parsed.data, result, false);
      return { ok: false, result };
    }

    const created = await createChatAppointment({
      organizationId: context.organizationId,
      contactId: context.contactId,
      conversationId: context.conversationId,
      date: parsed.data.date,
      startTime: parsed.data.startTime,
      endTime: parsed.data.endTime,
      purpose: parsed.data.purpose,
      notes: parsed.data.notes,
      createMeet: parsed.data.createMeet ?? true,
    });

    if (!created.ok) {
      await logToolRun(context, name, parsed.data, { error: created.error }, false);
      return { ok: false, result: { error: created.error } };
    }

    await insertSystemMessage({
      organizationId: context.organizationId,
      conversationId: context.conversationId,
      content: `Cita creada: ${formatTime(created.startsAt)} – ${formatTime(created.endsAt)} (${parsed.data.date}).`,
    });

    const result = {
      ok: true,
      startsAt: created.startsAt,
      endsAt: created.endsAt,
      meetingUrl: created.meetingUrl,
    };
    await logToolRun(context, name, parsed.data, result, true);
    return { ok: true, result };
  }

  if (name === "move_contact_to_stage") {
    if (!context.settings.toolsFunnel || !context.modules.funnels) {
      const result = { error: "La herramienta de embudo está desactivada." };
      await logToolRun(context, name, rawArgs, result, false);
      return { ok: false, result };
    }

    const parsed = moveContactToStageArgsSchema.safeParse(rawArgs);
    if (!parsed.success) {
      const result = { error: parsed.error.issues[0]?.message ?? "Argumentos inválidos para mover el embudo." };
      await logToolRun(context, name, rawArgs, result, false);
      return { ok: false, result };
    }

    const moved = await moveContactToFunnelStage({
      organizationId: context.organizationId,
      contactId: context.contactId,
      conversationId: context.conversationId,
      stageId: parsed.data.stageId,
      reason: parsed.data.reason,
      valueAmount: parsed.data.valueAmount,
    });

    if (!moved.ok) {
      await logToolRun(context, name, parsed.data, { error: moved.error }, false);
      return { ok: false, result: { error: moved.error } };
    }

    await insertSystemMessage({
      organizationId: context.organizationId,
      conversationId: context.conversationId,
      content: `Embudo: ${moved.stageName}. ${parsed.data.reason}`,
    });

    const result = { ok: true, stageName: moved.stageName };
    await logToolRun(context, name, parsed.data, result, true);
    return { ok: true, result };
  }

  if (name === "handoff_to_human") {
    if (!context.settings.toolsHandoff) {
      const result = { error: "La herramienta de handoff está desactivada." };
      await logToolRun(context, name, rawArgs, result, false);
      return { ok: false, result };
    }

    const parsed = handoffToHumanArgsSchema.safeParse(rawArgs);
    if (!parsed.success) {
      const result = { error: parsed.error.issues[0]?.message ?? "Indica por qué escalas a un humano." };
      await logToolRun(context, name, rawArgs, result, false);
      return { ok: false, result };
    }

    if (!areAdvisorsAvailable(context.settings.businessHours)) {
      const result = {
        error:
          "Los asesores no están disponibles ahora porque la oficina está cerrada. Sigue tú atendiendo. Explica que el equipo humano vuelve al abrir y no prometas una transferencia inmediata.",
      };
      await logToolRun(context, name, parsed.data, result, false);
      return { ok: false, result };
    }

    const admin = getSupabaseAdminClient();
    const now = new Date().toISOString();
    const { error } = await admin
      .from("conversations")
      .update({
        mode: "human",
        status: "in_progress",
        updated_at: now,
      })
      .eq("id", context.conversationId)
      .eq("organization_id", context.organizationId);

    if (error) {
      const result = { error: "No se pudo ceder la conversación." };
      await logToolRun(context, name, parsed.data, result, false);
      return { ok: false, result };
    }

    await insertSystemMessage({
      organizationId: context.organizationId,
      conversationId: context.conversationId,
      content: `Conversación cedida a un asesor. Motivo: ${parsed.data.reason}`,
    });

    const result = { ok: true, handoff: true };
    await logToolRun(context, name, parsed.data, result, true);
    return { ok: true, result, handoff: true };
  }

  if (name === "create_order") {
    if (!context.modules.orders) {
      const result = { error: "Los pedidos no están habilitados para este negocio." };
      await logToolRun(context, name, rawArgs, result, false);
      return { ok: false, result };
    }

    const parsed = createOrderArgsSchema.safeParse(rawArgs);
    if (!parsed.success) {
      const result = { error: parsed.error.issues[0]?.message ?? "Argumentos inválidos para el pedido." };
      await logToolRun(context, name, rawArgs, result, false);
      return { ok: false, result };
    }

    if (!parsed.data.confirmedByCustomer && !isCustomerConfirmationText(context.lastInboundText)) {
      const result = { error: "El cliente aún no confirmó el pedido. Resume ítems y total, y pide que responda CONFIRMAR." };
      await logToolRun(context, name, parsed.data, result, false);
      return { ok: false, result };
    }

    const created = await createCommerceOrderForAgent({
      organizationId: context.organizationId,
      contactId: context.contactId,
      conversationId: context.conversationId,
      turnId: context.turnId,
      channel: context.channel,
      fulfillment: isFulfillmentType(parsed.data.fulfillment) ? parsed.data.fulfillment : "unspecified",
      customerNote: parsed.data.customerNote,
      deliveryAddress: parsed.data.deliveryAddress,
      deliveryZone: parsed.data.deliveryZone,
      items: parsed.data.items,
    });

    if (!created.ok) {
      await logToolRun(context, name, parsed.data, { error: created.error }, false);
      return { ok: false, result: { error: created.error } };
    }

    await insertSystemMessage({
      organizationId: context.organizationId,
      conversationId: context.conversationId,
      content: `Pedido #${created.orderId}: ${created.summary}. Subtotal ${formatMoney(created.subtotal)}${created.discount ? ` · desc. ${formatMoney(created.discount)}` : ""} · IVA ${formatMoney(created.tax)}${created.deliveryFee ? ` · envío ${formatMoney(created.deliveryFee)}` : ""}. Total ${formatMoney(created.total)}. Stock descontado.`,
    });

    const result = {
      ok: true,
      orderId: created.orderId,
      total: created.total,
      summary: created.summary,
    };
    await logToolRun(context, name, parsed.data, result, true);
    return { ok: true, result };
  }

  if (name === "cancel_order") {
    if (!context.modules.orders) {
      const result = { error: "Los pedidos no están habilitados para este negocio." };
      await logToolRun(context, name, rawArgs, result, false);
      return { ok: false, result };
    }

    const parsed = cancelOrderArgsSchema.safeParse(rawArgs);
    if (!parsed.success) {
      const result = { error: parsed.error.issues[0]?.message ?? "Indica el pedido a cancelar." };
      await logToolRun(context, name, rawArgs, result, false);
      return { ok: false, result };
    }

    const cancelled = await cancelCommerceOrderForAgent({
      organizationId: context.organizationId,
      orderId: parsed.data.orderId,
      reason: parsed.data.reason,
    });

    if (!cancelled.ok) {
      await logToolRun(context, name, parsed.data, { error: cancelled.error }, false);
      return { ok: false, result: { error: cancelled.error } };
    }

    await insertSystemMessage({
      organizationId: context.organizationId,
      conversationId: context.conversationId,
      content: `Pedido #${cancelled.orderId} cancelado. Inventario restaurado. Motivo: ${parsed.data.reason}`,
    });

    const result = { ok: true, orderId: cancelled.orderId };
    await logToolRun(context, name, parsed.data, result, true);
    return { ok: true, result };
  }

  if (name === "send_image") {
    const parsed = sendImageArgsSchema.safeParse({
      productId: rawArgs.productId ?? rawArgs.product_id,
      assetId: rawArgs.assetId ?? rawArgs.asset_id,
      caption: rawArgs.caption,
    });
    if (!parsed.success) {
      const result = { error: parsed.error.issues[0]?.message ?? "Indica un productId o assetId válido." };
      await logToolRun(context, name, rawArgs, result, false);
      return { ok: false, result };
    }

    if (context.imagesSentThisTurn.count >= AGENT_MAX_IMAGES_PER_TURN) {
      const result = { error: "Ya se envió una imagen en esta respuesta. No mandes otra." };
      await logToolRun(context, name, parsed.data, result, false);
      return { ok: false, result };
    }

    const admin = getSupabaseAdminClient();
    let imageUrl = "";
    let title = "";

    if (parsed.data.productId) {
      const { data: product, error } = await admin
        .from("products")
        .select("id, name, image_url, parent_id, active")
        .eq("id", parsed.data.productId)
        .eq("organization_id", context.organizationId)
        .maybeSingle();

      imageUrl = typeof product?.image_url === "string" ? product.image_url.trim() : "";
      if (!imageUrl && product?.parent_id) {
        const { data: parent } = await admin
          .from("products")
          .select("image_url")
          .eq("id", product.parent_id)
          .eq("organization_id", context.organizationId)
          .maybeSingle();
        imageUrl = typeof parent?.image_url === "string" ? parent.image_url.trim() : "";
      }

      if (error || !product?.id || product.active === false || !imageUrl) {
        const result = { error: "Ese producto no existe, está inactivo o no tiene imagen. Responde en texto." };
        await logToolRun(context, name, parsed.data, result, false);
        return { ok: false, result };
      }
      title = typeof product.name === "string" ? product.name : "Producto";
    } else {
      const { data: article, error } = await admin
        .from("knowledge_articles")
        .select("id, title, image_url, active")
        .eq("id", parsed.data.assetId)
        .eq("organization_id", context.organizationId)
        .maybeSingle();

      imageUrl = typeof article?.image_url === "string" ? article.image_url.trim() : "";
      if (error || !article?.id || article.active === false || !imageUrl) {
        const result = { error: "Ese assetId no existe, está inactivo o no tiene imagen. Responde en texto." };
        await logToolRun(context, name, parsed.data, result, false);
        return { ok: false, result };
      }
      title = typeof article.title === "string" ? article.title : "Artículo";
    }

    context.imagesSentThisTurn.count += 1;
    const caption = parsed.data.caption?.trim() || null;
    const result = {
      ok: true,
      queued: true,
      productId: parsed.data.productId ?? null,
      assetId: parsed.data.assetId ?? null,
      title,
    };
    await logToolRun(context, name, parsed.data, result, true);
    return {
      ok: true,
      result,
      image: { mediaUrl: imageUrl, caption },
    };
  }

  const result = { error: `Herramienta desconocida: ${name}` };
  await logToolRun(context, name, rawArgs, result, false);
  return { ok: false, result };
};
