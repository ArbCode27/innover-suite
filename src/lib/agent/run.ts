import {
  AGENT_COURTESY_COOLDOWN_MS,
  AGENT_COURTESY_MESSAGE,
  AGENT_GUARDRAILS,
  AGENT_HANDOFF_MESSAGE,
  AGENT_HISTORY_LIMIT,
  AGENT_INBOUND_DEBOUNCE_MAX_MS,
  AGENT_INBOUND_DEBOUNCE_MS,
  AGENT_MAX_RETRIES,
  AGENT_MAX_SUPERSEDE_FOLLOWUPS,
  AGENT_MAX_TOOL_TURNS,
  AGENT_RETRY_BASE_MS,
  AGENT_STALE_RUNNING_MS,
} from "@/lib/agent/constants";
import { executeAgentTool } from "@/lib/agent/execute";
import {
  generateGeminiTurn,
  isGeminiConfigured,
  type GeminiContent,
  type GeminiTurnFailure,
} from "@/lib/agent/gemini";
import {
  buildCoalescedGeminiContents,
  ensureGeminiHistoryForGenerate,
  historyThroughInbound,
  trailingInboundIds,
  trailingInboundText,
} from "@/lib/agent/history";
import { isIncompleteAgentReply, resolveAgentReplyText } from "@/lib/agent/reply-text";
import { areAdvisorsAvailable, isAfterHoursAiCoverage } from "@/lib/agent/hours";
import { formatKnowledgeContext, loadAgentSettings, loadKnowledgeArticles } from "@/lib/agent/settings";
import { buildAgentToolDeclarations } from "@/lib/agent/tools";
import type { AgentJob } from "@/lib/agent/types";
import {
  formatCommerceContext,
  loadAgentCommerceSnapshot,
} from "@/lib/commerce/agent";
import {
  formatListingsContext,
  loadAgentListingsSnapshot,
} from "@/lib/listings/agent";
import { loadAgentFunnelSnapshot } from "@/lib/funnels/agent";
import {
  escalateConversationToHuman,
  insertSystemMessage,
  sendAiOutboundMessage,
} from "@/lib/inbox/agent-outbound";
import { loadOrganizationModulesAdmin } from "@/lib/modules/settings";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { logMetaWebhook } from "@/lib/webhooks/meta/logger";
import { CALENDAR_TIME_ZONE } from "@/lib/calendar/constants";
import { formatTime, toDateKey } from "@/lib/calendar/range";

const POSTGRES_UNIQUE_VIOLATION = "23505";

type ClaimedTurn = {
  id: number;
  retryCount: number;
  courtesySent: boolean;
};

type TurnFinishPatch = {
  status: "completed" | "skipped" | "failed";
  error?: string;
  retryCount?: number;
  lastModel?: string | null;
  retryable?: boolean;
  nextRetryAt?: string | null;
  courtesySent?: boolean;
};

type ExistingTurnRow = {
  id: number;
  inbound_message_id?: number | null;
  status?: string | null;
  retry_count?: number | null;
  retryable?: boolean | null;
  next_retry_at?: string | null;
  courtesy_sent?: boolean | null;
  updated_at?: string | null;
  created_at?: string | null;
};

type LatestInbound = {
  id: number;
  created_at: string;
};

type RunAgentOptions = {
  followUpsRemaining?: number;
};

const IMAGE_FAILED_HINT =
  "La imagen no se pudo enviar. Responde solo en texto: planes, precios y la siguiente pregunta. Frases completas. No vuelvas a llamar send_image.";

const INCOMPLETE_REPLY_HINT =
  "Tu mensaje al cliente está incompleto (frase cortada). Reescribe el mensaje entero en español, 3 o 4 frases cerradas, con planes o precios si aplica. No menciones tools ni IDs. No llames send_image.";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const toTimestamp = (value?: string | null) => {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

const isStaleRunningTurn = (row: ExistingTurnRow) => {
  if (row.status !== "running") return false;
  const startedAt = toTimestamp(row.updated_at) || toTimestamp(row.created_at);
  return startedAt > 0 && Date.now() - startedAt >= AGENT_STALE_RUNNING_MS;
};

const getLatestInboundMessage = async (
  organizationId: number,
  conversationId: number,
): Promise<LatestInbound | null> => {
  const admin = getSupabaseAdminClient();
  const { data } = await admin
    .from("messages")
    .select("id, created_at")
    .eq("organization_id", organizationId)
    .eq("conversation_id", conversationId)
    .eq("direction", "inbound")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data?.id || typeof data.created_at !== "string") {
    return null;
  }

  return { id: data.id as number, created_at: data.created_at };
};

const waitForInboundQuiet = async (organizationId: number, conversationId: number) => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < AGENT_INBOUND_DEBOUNCE_MAX_MS) {
    const latest = await getLatestInboundMessage(organizationId, conversationId);
    if (!latest) return;
    const ageMs = Date.now() - new Date(latest.created_at).getTime();
    if (!Number.isFinite(ageMs) || ageMs >= AGENT_INBOUND_DEBOUNCE_MS) {
      return;
    }
    const waitMs = Math.min(
      AGENT_INBOUND_DEBOUNCE_MS - ageMs + 25,
      AGENT_INBOUND_DEBOUNCE_MAX_MS - (Date.now() - startedAt),
    );
    if (waitMs <= 0) return;
    await sleep(waitMs);
  }
};

const findRunningTurn = async (organizationId: number, conversationId: number) => {
  const admin = getSupabaseAdminClient();
  const { data } = await admin
    .from("agent_turns")
    .select("id, status, retry_count, retryable, next_retry_at, courtesy_sent, updated_at, created_at, inbound_message_id")
    .eq("organization_id", organizationId)
    .eq("conversation_id", conversationId)
    .eq("status", "running")
    .order("updated_at", { ascending: false })
    .limit(1);

  const row = Array.isArray(data) ? data[0] : data;
  return (row as ExistingTurnRow | undefined) ?? null;
};

const asMetadata = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const hasRecentCourtesyMessage = async (organizationId: number, conversationId: number) => {
  const admin = getSupabaseAdminClient();
  const since = new Date(Date.now() - AGENT_COURTESY_COOLDOWN_MS).toISOString();
  const { data } = await admin
    .from("messages")
    .select("metadata")
    .eq("organization_id", organizationId)
    .eq("conversation_id", conversationId)
    .eq("direction", "outbound")
    .eq("sender_type", "ai")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(20);

  return (data ?? []).some((row) => asMetadata(row.metadata).kind === "courtesy");
};

const reopenTurn = async (turnId: number, fromStatus: "failed" | "running") => {
  const admin = getSupabaseAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("agent_turns")
    .update({ status: "running", error: null, updated_at: now })
    .eq("id", turnId)
    .eq("status", fromStatus)
    .select("id")
    .maybeSingle();

  if (!error) {
    return Boolean(data?.id);
  }

  const fallback = await admin
    .from("agent_turns")
    .update({ status: "running", error: null })
    .eq("id", turnId)
    .eq("status", fromStatus)
    .select("id")
    .maybeSingle();

  return Boolean(fallback.data?.id);
};

const claimAgentTurn = async (job: AgentJob): Promise<ClaimedTurn | null> => {
  const admin = getSupabaseAdminClient();
  const now = new Date().toISOString();
  const running = await findRunningTurn(job.organizationId, job.conversationId);

  if (running?.id && running.inbound_message_id !== job.inboundMessageId) {
    if (isStaleRunningTurn(running)) {
      await admin
        .from("agent_turns")
        .update({
          status: "skipped",
          error: "stale_running_superseded",
          retryable: false,
          next_retry_at: null,
          updated_at: now,
        })
        .eq("id", running.id)
        .eq("status", "running");
    } else {
      return null;
    }
  }

  const baseInsert = {
    organization_id: job.organizationId,
    conversation_id: job.conversationId,
    inbound_message_id: job.inboundMessageId,
    status: "running",
  };

  let data: { id: number; retry_count?: number | null; courtesy_sent?: boolean | null } | null = null;
  let error: { code?: string; message?: string } | null = null;

  const resilientInsert = await admin
    .from("agent_turns")
    .insert({
      ...baseInsert,
      retry_count: 0,
      retryable: false,
      courtesy_sent: false,
      updated_at: now,
    })
    .select("id, retry_count, courtesy_sent")
    .single();

  data = resilientInsert.data;
  error = resilientInsert.error;

  if (error && error.code !== POSTGRES_UNIQUE_VIOLATION) {
    const fallbackInsert = await admin.from("agent_turns").insert(baseInsert).select("id").single();
    data = fallbackInsert.data;
    error = fallbackInsert.error;
  }

  if (!error && data?.id) {
    return {
      id: data.id as number,
      retryCount: typeof data.retry_count === "number" ? data.retry_count : 0,
      courtesySent: data.courtesy_sent === true,
    };
  }

  if (error?.code !== POSTGRES_UNIQUE_VIOLATION) {
    throw error || new Error("No se pudo registrar el turno del agente.");
  }

  const { data: existing, error: existingError } = await admin
    .from("agent_turns")
    .select("id, status, retry_count, retryable, next_retry_at, courtesy_sent, updated_at, created_at")
    .eq("organization_id", job.organizationId)
    .eq("inbound_message_id", job.inboundMessageId)
    .maybeSingle();

  const existingRow =
    (existing as ExistingTurnRow | null) ??
    (
      await admin
        .from("agent_turns")
        .select("id, status")
        .eq("organization_id", job.organizationId)
        .eq("inbound_message_id", job.inboundMessageId)
        .maybeSingle()
    ).data;

  if (existingError && !existingRow?.id) {
    throw existingError || new Error("No se pudo leer el turno existente del agente.");
  }

  if (!existingRow?.id) {
    const runningAfterConflict = await findRunningTurn(job.organizationId, job.conversationId);
    if (runningAfterConflict?.id && runningAfterConflict.inbound_message_id !== job.inboundMessageId) {
      return null;
    }
    throw new Error("No se pudo leer el turno existente del agente.");
  }

  const row = existingRow as ExistingTurnRow;
  if (row.status === "completed" || row.status === "skipped") {
    return null;
  }

  const retryCount = typeof row.retry_count === "number" ? row.retry_count : 0;
  const retryable = row.retryable === true;
  const nextRetryAt = toTimestamp(row.next_retry_at);
  const canRetryFailed =
    row.status === "failed" && retryable && retryCount < AGENT_MAX_RETRIES && nextRetryAt <= Date.now();
  const canReclaimStale = isStaleRunningTurn(row) && retryCount < AGENT_MAX_RETRIES;

  if (!canRetryFailed && !canReclaimStale) {
    return null;
  }

  const reopened = await reopenTurn(row.id, canRetryFailed ? "failed" : "running");
  if (!reopened) {
    return null;
  }

  return {
    id: row.id,
    retryCount,
    courtesySent: row.courtesy_sent === true,
  };
};

const finishTurn = async (turnId: number, patch: TurnFinishPatch) => {
  const admin = getSupabaseAdminClient();
  const payload: Record<string, unknown> = {
    status: patch.status,
    error: patch.error ?? null,
    updated_at: new Date().toISOString(),
  };
  if (patch.retryCount !== undefined) payload.retry_count = patch.retryCount;
  if (patch.lastModel !== undefined) payload.last_model = patch.lastModel;
  if (patch.retryable !== undefined) payload.retryable = patch.retryable;
  if (patch.nextRetryAt !== undefined) payload.next_retry_at = patch.nextRetryAt;
  if (patch.courtesySent !== undefined) payload.courtesy_sent = patch.courtesySent;

  const { error } = await admin.from("agent_turns").update(payload).eq("id", turnId);
  if (!error) return;

  await admin
    .from("agent_turns")
    .update({ status: patch.status, error: patch.error ?? null })
    .eq("id", turnId);
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
  commerceContext: string | null;
  listingsContext: string | null;
  knowledgeContext: string | null;
  advisorsAvailable: boolean;
  closedMessage: string;
  officeTimezone: string;
}) => {
  const stageList = params.stages.map((stage) => `- ${stage.name} (stageId: ${stage.id})`).join("\n") || "- (sin etapas)";
  const appointments = params.upcomingAppointments.length
    ? params.upcomingAppointments.map((item) => `- ${item}`).join("\n")
    : "- ninguna";
  const commerceBlock = params.commerceContext
    ? `
${params.commerceContext}
- Confirmación de pedido: resume el ticket (ítems, IVA, envío y total) y espera un sí o CONFIRMAR antes de create_order.`
    : "";
  const listingsBlock = params.listingsContext ? `\n${params.listingsContext}` : "";
  const knowledgeBlock = params.knowledgeContext ? `\n${params.knowledgeContext}` : "";

  return `${AGENT_GUARDRAILS}

Prompt de negocio:
${params.prompt}

Contexto de esta conversación:
- Fecha de hoy: ${params.today} (${params.officeTimezone})
- Canal: ${params.channel}
- Contacto: ${params.contactName}
- Confirmación de cita obligatoria: ${params.requireConfirmation ? "sí" : "no"}
- IA: activa 24/7
- Asesores humanos: ${params.advisorsAvailable ? "disponibles ahora (horario de oficina)" : "no disponibles ahora (oficina cerrada)"}
${params.advisorsAvailable ? "" : `- Si piden un asesor, NO uses handoff_to_human. Explica el horario y sigue ayudando. Tono sugerido: "${params.closedMessage}"`}
- El cliente puede enviar texto, fotos, audios, videos, documentos o ubicaciones. Interpreta esas entradas. No digas que no puedes ver archivos si te llegaron.
- Embudo: ${params.funnelName || "no configurado"}
- Etapa actual: ${params.currentStage}
- Etapas disponibles:
${stageList}
- Próximas citas del contacto:
${appointments}${commerceBlock}${listingsBlock}${knowledgeBlock}`;
};

const handleUnrecoverableTurn = async (params: {
  job: AgentJob;
  turnId: number;
  retryCount: number;
  courtesySent: boolean;
  failure: GeminiTurnFailure;
  advisorsAvailable: boolean;
  closedMessage: string;
}) => {
  const nextRetryCount = params.retryCount + 1;
  const reachedLimit = nextRetryCount >= AGENT_MAX_RETRIES || !params.failure.retryable;
  const latestInbound = await getLatestInboundMessage(params.job.organizationId, params.job.conversationId);
  const superseded = Boolean(latestInbound && latestInbound.id !== params.job.inboundMessageId);

  if (superseded) {
    await finishTurn(params.turnId, {
      status: "skipped",
      error: "superseded_by_newer_inbound",
      retryCount: nextRetryCount,
      lastModel: params.failure.model,
      retryable: false,
      nextRetryAt: null,
      courtesySent: params.courtesySent,
    });
    logMetaWebhook("info", "agent.turn_superseded", {
      organizationId: params.job.organizationId,
      conversationId: params.job.conversationId,
      inboundMessageId: params.job.inboundMessageId,
      latestInboundId: latestInbound?.id,
      error: params.failure.error,
    });
    return true;
  }

  if (reachedLimit) {
    if (params.advisorsAvailable) {
      await sendAiOutboundMessage({
        organizationId: params.job.organizationId,
        conversationId: params.job.conversationId,
        text: AGENT_HANDOFF_MESSAGE,
        metadata: { source: "agent_fallback", kind: "handoff" },
      });
      await escalateConversationToHuman({
        organizationId: params.job.organizationId,
        conversationId: params.job.conversationId,
        reason: "El agente no pudo responder tras varios reintentos.",
      });
    } else {
      await sendAiOutboundMessage({
        organizationId: params.job.organizationId,
        conversationId: params.job.conversationId,
        text: params.closedMessage,
        metadata: { source: "agent_fallback", kind: "office_closed" },
      });
    }
    await finishTurn(params.turnId, {
      status: "failed",
      error: params.failure.error,
      retryCount: nextRetryCount,
      lastModel: params.failure.model,
      retryable: false,
      nextRetryAt: null,
      courtesySent: params.courtesySent,
    });
    logMetaWebhook("error", "agent.turn_escalated", {
      organizationId: params.job.organizationId,
      conversationId: params.job.conversationId,
      inboundMessageId: params.job.inboundMessageId,
      error: params.failure.error,
      lastModel: params.failure.model,
    });
    return false;
  }

  let courtesySent = params.courtesySent;
  const courtesyOnCooldown = await hasRecentCourtesyMessage(
    params.job.organizationId,
    params.job.conversationId,
  );
  if (!courtesySent && !courtesyOnCooldown) {
    const courtesy = await sendAiOutboundMessage({
      organizationId: params.job.organizationId,
      conversationId: params.job.conversationId,
      text: AGENT_COURTESY_MESSAGE,
      metadata: { source: "agent_fallback", kind: "courtesy" },
    });
    courtesySent = courtesy.ok;
  }

  const nextRetryAt = new Date(Date.now() + nextRetryCount * AGENT_RETRY_BASE_MS).toISOString();
  await finishTurn(params.turnId, {
    status: "failed",
    error: params.failure.error,
    retryCount: nextRetryCount,
    lastModel: params.failure.model,
    retryable: true,
    nextRetryAt,
    courtesySent,
  });

  logMetaWebhook("warn", "agent.turn_retry_scheduled", {
    organizationId: params.job.organizationId,
    conversationId: params.job.conversationId,
    inboundMessageId: params.job.inboundMessageId,
    error: params.failure.error,
    lastModel: params.failure.model,
    retryCount: nextRetryCount,
    nextRetryAt,
  });
  return false;
};

export const runConversationAgent = async (job: AgentJob, options: RunAgentOptions = {}) => {
  const followUpsRemaining = options.followUpsRemaining ?? AGENT_MAX_SUPERSEDE_FOLLOWUPS;

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

  const claimed = await claimAgentTurn(job);
  if (!claimed) {
    return;
  }

  const turnId = claimed.id;
  const admin = getSupabaseAdminClient();
  let lastModel: string | null = null;
  const modules = await loadOrganizationModulesAdmin(job.organizationId);
  const advisorsAvailable = areAdvisorsAvailable(settings.businessHours);

  const followUpIfNeeded = async () => {
    if (followUpsRemaining <= 0) return;
    await waitForInboundQuiet(job.organizationId, job.conversationId);
    const latest = await getLatestInboundMessage(job.organizationId, job.conversationId);
    if (!latest || latest.id === job.inboundMessageId) return;
    await runConversationAgent(
      { ...job, inboundMessageId: latest.id },
      { followUpsRemaining: followUpsRemaining - 1 },
    );
  };

  try {
    const { data: conversation } = await admin
      .from("conversations")
      .select("id, mode, channel, contact_id, contacts(full_name)")
      .eq("id", job.conversationId)
      .eq("organization_id", job.organizationId)
      .maybeSingle();

    if (!conversation?.id || !conversation.contact_id) {
      await finishTurn(turnId, { status: "skipped", error: "Conversación no elegible para el agente." });
      return;
    }

    const shouldCoverAfterHours =
      conversation.mode === "human" &&
      !advisorsAvailable &&
      isAfterHoursAiCoverage(settings.businessHours);

    if (conversation.mode !== "ai" && !shouldCoverAfterHours) {
      await finishTurn(turnId, { status: "skipped", error: "Conversación no elegible para el agente." });
      return;
    }

    if (shouldCoverAfterHours) {
      const now = new Date().toISOString();
      await admin
        .from("conversations")
        .update({
          mode: "ai",
          assigned_user_id: null,
          assigned_at: null,
          updated_at: now,
        })
        .eq("id", job.conversationId)
        .eq("organization_id", job.organizationId);
      await insertSystemMessage({
        organizationId: job.organizationId,
        conversationId: job.conversationId,
        content: "Fuera de horario de oficina. La IA continúa la atención.",
      });
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

    const chronological = [...(messageRows ?? [])].reverse().filter((row) => row.sender_type !== "system");
    const history = historyThroughInbound(chronological, job.inboundMessageId);
    const burstIds = trailingInboundIds(history);
    const contents: GeminiContent[] = ensureGeminiHistoryForGenerate(
      await buildCoalescedGeminiContents(history, burstIds),
    );
    const lastInboundText = trailingInboundText(history);

    if (!contents.length) {
      await finishTurn(turnId, { status: "skipped", error: "Sin contenido para responder." });
      return;
    }

    const funnel = modules.funnels
      ? await loadAgentFunnelSnapshot(job.organizationId, conversation.contact_id as number)
      : { funnelName: null, stages: [] as Array<{ id: number; name: string }>, currentStage: null };

    const appointmentRows = modules.calendar
      ? (
          await admin
            .from("appointments")
            .select("title, starts_at, ends_at")
            .eq("organization_id", job.organizationId)
            .eq("contact_id", conversation.contact_id)
            .neq("status", "cancelled")
            .gte("starts_at", new Date().toISOString())
            .order("starts_at", { ascending: true })
            .limit(5)
        ).data
      : [];

    let commerceContext: string | null = null;
    if (modules.catalog) {
      try {
        const snapshot = await loadAgentCommerceSnapshot(job.organizationId);
        commerceContext = formatCommerceContext(snapshot);
      } catch (error) {
        logMetaWebhook("warn", "agent.catalog_unavailable", {
          organizationId: job.organizationId,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    let listingsContext: string | null = null;
    if (modules.listings) {
      try {
        const listings = await loadAgentListingsSnapshot(job.organizationId);
        listingsContext = formatListingsContext(listings);
      } catch (error) {
        logMetaWebhook("warn", "agent.listings_unavailable", {
          organizationId: job.organizationId,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    let knowledgeContext: string | null = null;
    try {
      const articles = await loadKnowledgeArticles(job.organizationId, true);
      knowledgeContext = formatKnowledgeContext(articles) || null;
      const { data: notes } = await admin
        .from("contact_notes")
        .select("body")
        .eq("organization_id", job.organizationId)
        .eq("contact_id", conversation.contact_id)
        .eq("visible_to_agent", true)
        .order("created_at", { ascending: false })
        .limit(8);
      const noteLines = (notes ?? [])
        .map((note) => (typeof note.body === "string" ? note.body.trim() : ""))
        .filter(Boolean);
      if (noteLines.length) {
        knowledgeContext = `${knowledgeContext ?? ""}\nNotas internas visibles para el agente:\n${noteLines.map((line) => `- ${line}`).join("\n")}`.trim();
      }
    } catch {
      knowledgeContext = knowledgeContext;
    }

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
      commerceContext,
      listingsContext,
      knowledgeContext,
      advisorsAvailable,
      closedMessage: settings.closedMessage,
      officeTimezone: settings.businessHours.timezone || CALENDAR_TIME_ZONE,
    });

    const toolDeclarations = buildAgentToolDeclarations(settings, modules);
    let functionCallsPending = true;
    let draftText = "";
    let finalText = "";
    let handoff = false;
    let imageFailed = false;
    let pinnedModel: string | null = settings.model;
    let pendingImage: { mediaUrl: string; caption: string | null } | null = null;
    const imagesSentThisTurn = { count: 0 };

    const generate = async (tools: typeof toolDeclarations) => {
      const outcome = await generateGeminiTurn({
        preferredModel: pinnedModel,
        systemInstruction,
        contents,
        tools,
      });
      if (outcome.ok) {
        pinnedModel = outcome.model;
        lastModel = outcome.model;
      } else {
        lastModel = outcome.model;
      }
      return outcome;
    };

    const rememberDraft = (text: string) => {
      const trimmed = text.trim();
      if (trimmed) {
        draftText = trimmed;
      }
    };

    const generateTextOnly = async (hint: string) => {
      contents.push({ role: "user", parts: [{ text: hint }] });
      return generate([]);
    };

    for (let turn = 0; turn < AGENT_MAX_TOOL_TURNS + 1 && functionCallsPending; turn += 1) {
      const latestDuringTurn = await getLatestInboundMessage(job.organizationId, job.conversationId);
      if (latestDuringTurn && latestDuringTurn.id !== job.inboundMessageId) {
        await finishTurn(turnId, {
          status: "skipped",
          error: "superseded_by_newer_inbound",
          lastModel,
          retryable: false,
          retryCount: claimed.retryCount,
          nextRetryAt: null,
        });
        logMetaWebhook("info", "agent.turn_superseded", {
          organizationId: job.organizationId,
          conversationId: job.conversationId,
          inboundMessageId: job.inboundMessageId,
          latestInboundId: latestDuringTurn.id,
        });
        await followUpIfNeeded();
        return;
      }

      const generation = await generate(toolDeclarations);
      if (!generation.ok) {
        const superseded = await handleUnrecoverableTurn({
          job,
          turnId,
          retryCount: claimed.retryCount,
          courtesySent: claimed.courtesySent,
          advisorsAvailable,
          closedMessage: settings.closedMessage,
          failure: generation,
        });
        if (superseded) await followUpIfNeeded();
        return;
      }

      rememberDraft(generation.text);

      if (!generation.functionCalls.length) {
        finalText = generation.text;
        functionCallsPending = false;
        break;
      }

      contents.push({
        role: "model",
        parts: generation.modelParts.length
          ? generation.modelParts
          : generation.functionCalls.map((call) => ({
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
            channel: conversation.channel as string,
            lastInboundText,
            settings,
            modules,
            imagesSentThisTurn,
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
        if (executed.image && !pendingImage) {
          pendingImage = executed.image;
          imageFailed = false;
        } else if (call.name === "send_image" && !executed.ok && !pendingImage) {
          imageFailed = true;
        }
      }

      contents.push({ role: "user", parts: responseParts });

      if (imageFailed && !pendingImage) {
        const fallback = await generateTextOnly(IMAGE_FAILED_HINT);
        if (!fallback.ok) {
          const superseded = await handleUnrecoverableTurn({
            job,
            turnId,
            retryCount: claimed.retryCount,
            courtesySent: claimed.courtesySent,
            advisorsAvailable,
            closedMessage: settings.closedMessage,
            failure: fallback,
          });
          if (superseded) await followUpIfNeeded();
          return;
        }
        rememberDraft(fallback.text);
        finalText = fallback.text;
        functionCallsPending = false;
        break;
      }

      if (handoff) {
        const closing = await generate([]);
        if (!closing.ok) {
          const superseded = await handleUnrecoverableTurn({
            job,
            turnId,
            retryCount: claimed.retryCount,
            courtesySent: claimed.courtesySent,
            advisorsAvailable,
            closedMessage: settings.closedMessage,
            failure: closing,
          });
          if (superseded) await followUpIfNeeded();
          return;
        }
        rememberDraft(closing.text);
        finalText = closing.text;
        functionCallsPending = false;
      }
    }

    finalText = resolveAgentReplyText(draftText, finalText);

    if (isIncompleteAgentReply(finalText) || (!finalText && !pendingImage && draftText)) {
      const repaired = await generateTextOnly(INCOMPLETE_REPLY_HINT);
      if (repaired.ok) {
        rememberDraft(repaired.text);
        finalText = resolveAgentReplyText(draftText, repaired.text);
      }
    }

    if (isIncompleteAgentReply(finalText)) {
      const caption = pendingImage?.caption?.trim() ?? "";
      finalText = caption && !isIncompleteAgentReply(caption) ? caption : "";
    }

    if (!finalText && !pendingImage) {
      await finishTurn(turnId, {
        status: "completed",
        lastModel,
        retryable: false,
        retryCount: claimed.retryCount,
      });
      await followUpIfNeeded();
      return;
    }

    const latestInbound = await getLatestInboundMessage(job.organizationId, job.conversationId);
    if (latestInbound && latestInbound.id !== job.inboundMessageId) {
      await finishTurn(turnId, {
        status: "skipped",
        error: "superseded_by_newer_inbound",
        lastModel,
        retryable: false,
        retryCount: claimed.retryCount,
        nextRetryAt: null,
      });
      logMetaWebhook("info", "agent.turn_superseded", {
        organizationId: job.organizationId,
        conversationId: job.conversationId,
        inboundMessageId: job.inboundMessageId,
        latestInboundId: latestInbound.id,
      });
      await followUpIfNeeded();
      return;
    }

    const sent = await sendAiOutboundMessage({
      organizationId: job.organizationId,
      conversationId: job.conversationId,
      text: finalText,
      mediaUrl: pendingImage?.mediaUrl,
      metadata: { source: "agent", model: lastModel },
    });

    if (!sent.ok) {
      const superseded = await handleUnrecoverableTurn({
        job,
        turnId,
        retryCount: claimed.retryCount,
        courtesySent: claimed.courtesySent,
        advisorsAvailable,
        closedMessage: settings.closedMessage,
        failure: {
          ok: false,
          model: lastModel,
          error: sent.error,
          status: null,
          retryable: true,
        },
      });
      logMetaWebhook("error", "agent.outbound_failed", {
        organizationId: job.organizationId,
        conversationId: job.conversationId,
        error: sent.error,
        lastModel,
      });
      if (superseded) await followUpIfNeeded();
      return;
    }

    await finishTurn(turnId, {
      status: "completed",
      lastModel,
      retryable: false,
      retryCount: claimed.retryCount,
      nextRetryAt: null,
    });
    await followUpIfNeeded();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const superseded = await handleUnrecoverableTurn({
      job,
      turnId,
      retryCount: claimed.retryCount,
      courtesySent: claimed.courtesySent,
      advisorsAvailable,
      closedMessage: settings.closedMessage,
      failure: {
        ok: false,
        model: lastModel,
        error: message,
        status: null,
        retryable: true,
      },
    });
    logMetaWebhook("error", "agent.turn_failed", {
      organizationId: job.organizationId,
      conversationId: job.conversationId,
      inboundMessageId: job.inboundMessageId,
      error: message,
      lastModel,
    });
    if (superseded) await followUpIfNeeded();
  }
};

export const runConversationAgentJobs = async (jobs: AgentJob[]) => {
  const latestByConversation = new Map<number, AgentJob>();
  for (const job of jobs) {
    latestByConversation.set(job.conversationId, job);
  }

  for (const job of latestByConversation.values()) {
    await waitForInboundQuiet(job.organizationId, job.conversationId);
    const latestInbound = await getLatestInboundMessage(job.organizationId, job.conversationId);
    if (!latestInbound) continue;
    await runConversationAgent({
      ...job,
      inboundMessageId: latestInbound.id,
    });
  }
};

const toAgentJob = (row: {
  organization_id: number;
  conversation_id: number;
  inbound_message_id: number;
}): AgentJob => ({
  organizationId: row.organization_id,
  conversationId: row.conversation_id,
  inboundMessageId: row.inbound_message_id,
});

export const retryFailedAgentTurns = async (limit = 20) => {
  const admin = getSupabaseAdminClient();
  const now = new Date().toISOString();
  const staleBefore = new Date(Date.now() - AGENT_STALE_RUNNING_MS).toISOString();

  const { data: failedRows, error: failedError } = await admin
    .from("agent_turns")
    .select("organization_id, conversation_id, inbound_message_id")
    .eq("status", "failed")
    .eq("retryable", true)
    .lte("next_retry_at", now)
    .lt("retry_count", AGENT_MAX_RETRIES)
    .order("next_retry_at", { ascending: true })
    .limit(limit);

  if (failedError) {
    throw failedError;
  }

  const remaining = Math.max(limit - (failedRows?.length ?? 0), 0);
  let staleRows: Array<{
    organization_id: number;
    conversation_id: number;
    inbound_message_id: number;
  }> = [];

  if (remaining > 0) {
    const staleQuery = await admin
      .from("agent_turns")
      .select("organization_id, conversation_id, inbound_message_id")
      .eq("status", "running")
      .lt("updated_at", staleBefore)
      .lt("retry_count", AGENT_MAX_RETRIES)
      .order("updated_at", { ascending: true })
      .limit(remaining);

    if (!staleQuery.error) {
      staleRows = (staleQuery.data ?? []) as typeof staleRows;
    }
  }

  const seen = new Set<number>();
  const jobs: AgentJob[] = [];
  for (const row of [...(failedRows ?? []), ...staleRows]) {
    const job = toAgentJob(row as {
      organization_id: number;
      conversation_id: number;
      inbound_message_id: number;
    });
    if (seen.has(job.inboundMessageId)) continue;
    seen.add(job.inboundMessageId);
    jobs.push(job);
  }

  await runConversationAgentJobs(jobs);
  return jobs.length;
};
