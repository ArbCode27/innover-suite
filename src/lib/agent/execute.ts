import { createChatAppointment } from "@/lib/calendar/agent";
import { moveContactToFunnelStage } from "@/lib/funnels/agent";
import { insertSystemMessage } from "@/lib/inbox/agent-outbound";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  createAppointmentArgsSchema,
  handoffToHumanArgsSchema,
  moveContactToStageArgsSchema,
} from "@/lib/agent/tools";
import type { AgentSettings } from "@/lib/agent/types";
import { formatTime } from "@/lib/calendar/range";

type ToolContext = {
  organizationId: number;
  conversationId: number;
  contactId: number;
  turnId: number;
  settings: AgentSettings;
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
): Promise<{ ok: boolean; result: Record<string, unknown>; handoff?: boolean }> => {
  if (name === "create_appointment") {
    if (!context.settings.toolsCalendar) {
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
    if (!context.settings.toolsFunnel) {
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

  const result = { error: `Herramienta desconocida: ${name}` };
  await logToolRun(context, name, rawArgs, result, false);
  return { ok: false, result };
};
