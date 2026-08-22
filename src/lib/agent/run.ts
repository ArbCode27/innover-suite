import { AGENT_GUARDRAILS, AGENT_HISTORY_LIMIT, AGENT_MAX_TOOL_TURNS } from "@/lib/agent/constants";
import { executeAgentTool } from "@/lib/agent/execute";
import { generateGeminiTurn, isGeminiConfigured, type GeminiContent } from "@/lib/agent/gemini";
import { loadAgentSettings } from "@/lib/agent/settings";
import { buildAgentToolDeclarations } from "@/lib/agent/tools";
import type { AgentJob } from "@/lib/agent/types";
import { loadAgentFunnelSnapshot } from "@/lib/funnels/agent";
import { sendAiOutboundMessage } from "@/lib/inbox/agent-outbound";
import { buildGeminiMessageParts } from "@/lib/media/agent";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { logMetaWebhook } from "@/lib/webhooks/meta/logger";
import { CALENDAR_TIME_ZONE } from "@/lib/calendar/constants";
import { formatTime, toDateKey } from "@/lib/calendar/range";

const POSTGRES_UNIQUE_VIOLATION = "23505";

const claimAgentTurn = async (job: AgentJob) => {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("agent_turns")
    .insert({
      organization_id: job.organizationId,
      conversation_id: job.conversationId,
      inbound_message_id: job.inboundMessageId,
      status: "running",
    })
    .select("id")
    .single();

  if (error?.code === POSTGRES_UNIQUE_VIOLATION) {
    return null;
  }

  if (error || !data?.id) {
    throw error || new Error("No se pudo registrar el turno del agente.");
  }

  return data.id as number;
};

const finishTurn = async (turnId: number, status: "completed" | "skipped" | "failed", error?: string) => {
  const admin = getSupabaseAdminClient();
  await admin.from("agent_turns").update({ status, error: error ?? null }).eq("id", turnId);
};

const buildSystemInstruction = (params: {
  prompt: string;
  contactName: string;
  channel: string;
  requireConfirmation: boolean;
  today: string;
  funnelName: string | null;
  currentStage: string;
  stages: Array<{ id: number; name: string }>;
  upcomingAppointments: string[];
}) => {
  const stageList = params.stages.map((stage) => `- ${stage.name} (stageId: ${stage.id})`).join("\n") || "- (sin etapas)";
  const appointments = params.upcomingAppointments.length
    ? params.upcomingAppointments.map((item) => `- ${item}`).join("\n")
    : "- ninguna";

  return `${AGENT_GUARDRAILS}

Prompt de negocio:
${params.prompt}

Contexto de esta conversación:
- Fecha de hoy: ${params.today} (${CALENDAR_TIME_ZONE})
- Canal: ${params.channel}
- Contacto: ${params.contactName}
- Confirmación de cita obligatoria: ${params.requireConfirmation ? "sí" : "no"}
- El cliente puede enviar texto, fotos, audios, videos, documentos o ubicaciones. Interpreta esas entradas. No digas que no puedes ver archivos si te llegaron.
- Embudo: ${params.funnelName || "no configurado"}
- Etapa actual: ${params.currentStage}
- Etapas disponibles:
${stageList}
- Próximas citas del contacto:
${appointments}`;
};

export const runConversationAgent = async (job: AgentJob) => {
  if (!isGeminiConfigured()) {
    logMetaWebhook("warn", "agent.skipped_missing_gemini_key", {
      organizationId: job.organizationId,
      conversationId: job.conversationId,
    });
    return;
  }

  const settings = await loadAgentSettings(job.organizationId);
  if (!settings.enabled) {
    return;
  }

  const turnId = await claimAgentTurn(job);
  if (!turnId) {
    return;
  }

  const admin = getSupabaseAdminClient();

  try {
    const { data: conversation } = await admin
      .from("conversations")
      .select("id, mode, channel, contact_id, contacts(full_name)")
      .eq("id", job.conversationId)
      .eq("organization_id", job.organizationId)
      .maybeSingle();

    if (!conversation?.id || conversation.mode !== "ai" || !conversation.contact_id) {
      await finishTurn(turnId, "skipped", "Conversación no elegible para el agente.");
      return;
    }

    const contactNameRaw = conversation.contacts as { full_name?: string } | { full_name?: string }[] | null;
    const contactName = Array.isArray(contactNameRaw)
      ? contactNameRaw[0]?.full_name
      : contactNameRaw?.full_name;

    const { data: messageRows } = await admin
      .from("messages")
      .select("id, direction, sender_type, content, metadata")
      .eq("conversation_id", job.conversationId)
      .eq("organization_id", job.organizationId)
      .order("created_at", { ascending: false })
      .limit(AGENT_HISTORY_LIMIT);

    const history = [...(messageRows ?? [])].reverse().filter((row) => row.sender_type !== "system");
    const contents: GeminiContent[] = [];

    for (const row of history) {
      const includeBinary = row.id === job.inboundMessageId && row.direction === "inbound";
      const parts = await buildGeminiMessageParts({
        content: typeof row.content === "string" ? row.content : null,
        metadata: row.metadata,
        includeBinary,
      });
      if (!parts.length) continue;

      contents.push({
        role: row.direction === "inbound" ? "user" : "model",
        parts,
      });
    }

    if (!contents.length) {
      await finishTurn(turnId, "skipped", "Sin contenido para responder.");
      return;
    }

    const funnel = await loadAgentFunnelSnapshot(job.organizationId, conversation.contact_id as number);
    const { data: appointmentRows } = await admin
      .from("appointments")
      .select("title, starts_at, ends_at")
      .eq("organization_id", job.organizationId)
      .eq("contact_id", conversation.contact_id)
      .neq("status", "cancelled")
      .gte("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true })
      .limit(5);

    const systemInstruction = buildSystemInstruction({
      prompt: settings.systemPrompt,
      contactName: contactName || "Cliente",
      channel: conversation.channel as string,
      requireConfirmation: settings.requireBookingConfirmation,
      today: toDateKey(new Date()),
      funnelName: funnel.funnelName,
      currentStage: funnel.currentStage?.name || "sin etapa",
      stages: funnel.stages,
      upcomingAppointments: (appointmentRows ?? []).map(
        (row) => `${row.title}: ${formatTime(row.starts_at as string)} – ${formatTime(row.ends_at as string)}`,
      ),
    });

    const toolDeclarations = buildAgentToolDeclarations(settings);
    let functionCallsPending = true;
    let finalText = "";
    let handoff = false;

    for (let turn = 0; turn < AGENT_MAX_TOOL_TURNS + 1 && functionCallsPending; turn += 1) {
      const generation = await generateGeminiTurn({
        model: settings.model,
        systemInstruction,
        contents,
        tools: toolDeclarations,
      });

      if (!generation.functionCalls.length) {
        finalText = generation.text;
        functionCallsPending = false;
        break;
      }

      contents.push({
        role: "model",
        parts: generation.functionCalls.map((call) => ({
          functionCall: { name: call.name, args: call.args },
        })),
      });

      const responseParts = [];
      for (const call of generation.functionCalls) {
        const executed = await executeAgentTool(
          {
            organizationId: job.organizationId,
            conversationId: job.conversationId,
            contactId: conversation.contact_id as number,
            turnId,
            settings,
          },
          call.name,
          call.args,
        );
        responseParts.push({
          functionResponse: {
            name: call.name,
            response: executed.result,
          },
        });
        if (executed.handoff) {
          handoff = true;
        }
      }

      contents.push({ role: "user", parts: responseParts });
      if (handoff) {
        const closing = await generateGeminiTurn({
          model: settings.model,
          systemInstruction,
          contents,
          tools: [],
        });
        finalText = closing.text;
        functionCallsPending = false;
      }
    }

    if (!finalText) {
      await finishTurn(turnId, "completed");
      return;
    }

    const sent = await sendAiOutboundMessage({
      organizationId: job.organizationId,
      conversationId: job.conversationId,
      text: finalText,
    });

    if (!sent.ok) {
      await finishTurn(turnId, "failed", sent.error);
      logMetaWebhook("error", "agent.outbound_failed", {
        organizationId: job.organizationId,
        conversationId: job.conversationId,
        error: sent.error,
      });
      return;
    }

    await finishTurn(turnId, "completed");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await finishTurn(turnId, "failed", message);
    logMetaWebhook("error", "agent.turn_failed", {
      organizationId: job.organizationId,
      conversationId: job.conversationId,
      inboundMessageId: job.inboundMessageId,
      error: message,
    });
  }
};

export const runConversationAgentJobs = async (jobs: AgentJob[]) => {
  const latestByConversation = new Map<number, AgentJob>();
  for (const job of jobs) {
    latestByConversation.set(job.conversationId, job);
  }

  for (const job of latestByConversation.values()) {
    await runConversationAgent(job);
  }
};
