import {
  LEAD_RECOVERY_DEFAULT_PROMPT,
  LEAD_RECOVERY_IDLE_HOURS_DEFAULT,
} from "@/lib/agent/constants";
import { generateGeminiTurn } from "@/lib/agent/gemini";
import { contentsFromPlainHistory } from "@/lib/agent/history";
import { areAdvisorsAvailable } from "@/lib/agent/hours";
import { loadAgentSettings } from "@/lib/agent/settings";
import type { AgentSettings } from "@/lib/agent/types";
import { insertSystemMessage, sendAiOutboundMessage } from "@/lib/inbox/agent-outbound";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { logMetaWebhook } from "@/lib/webhooks/meta/logger";

const MAX_ORGS = 40;
const MAX_PER_ORG = 8;
const HISTORY_LIMIT = 8;

type SettingsRow = {
  organization_id: number;
  enabled: boolean;
  lead_recovery_enabled?: boolean | null;
};

type FunnelCardRow = {
  conversation_id: number | null;
  contact_id: number | null;
};

type ConversationRow = {
  id: number;
  organization_id: number;
  mode: string;
  status: string;
  last_message_at: string | null;
  last_message_direction?: string | null;
  last_message_preview?: string | null;
  metadata: unknown;
  contact_id: number | null;
  contacts?: { full_name?: string | null } | { full_name?: string | null }[] | null;
};

type RecoverOutcome = "recovered" | "skipped" | "failed";

const asRecord = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const contactNameFromRow = (row: ConversationRow) => {
  const contacts = row.contacts;
  if (Array.isArray(contacts)) return contacts[0]?.full_name?.trim() || "el cliente";
  return contacts?.full_name?.trim() || "el cliente";
};

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

const isWithinCooldown = (metadata: unknown, cooldownHours: number) => {
  const recoveredAt = asRecord(metadata).lead_recovered_at;
  if (typeof recoveredAt !== "string" || !recoveredAt) return false;
  const parsed = Date.parse(recoveredAt);
  if (Number.isNaN(parsed)) return false;
  return Date.now() - parsed < cooldownHours * 60 * 60 * 1000;
};

const resolveRecoveryStageId = async (organizationId: number, settings: AgentSettings) => {
  const admin = getSupabaseAdminClient();
  if (settings.leadRecoveryStageId) {
    const { data } = await admin
      .from("funnel_stages")
      .select("id, funnels!inner(organization_id)")
      .eq("id", settings.leadRecoveryStageId)
      .eq("funnels.organization_id", organizationId)
      .maybeSingle();
    if (data?.id) return data.id as number;
  }

  const { data: funnel } = await admin
    .from("funnels")
    .select("id")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!funnel?.id) return null;

  const { data: stages } = await admin
    .from("funnel_stages")
    .select("id, name, order_index")
    .eq("funnel_id", funnel.id)
    .order("order_index", { ascending: true })
    .limit(8);

  const leadStage = (stages ?? []).find((row) => String(row.name).trim().toLowerCase() === "lead");
  return (leadStage?.id as number | undefined) ?? (stages?.[0]?.id as number | undefined) ?? null;
};

const markRecoveryAttempt = async (
  organizationId: number,
  conversationId: number,
  metadata: unknown,
) => {
  const admin = getSupabaseAdminClient();
  const now = new Date().toISOString();
  await admin
    .from("conversations")
    .update({
      metadata: {
        ...asRecord(metadata),
        lead_recovered_at: now,
      },
      updated_at: now,
    })
    .eq("id", conversationId)
    .eq("organization_id", organizationId);
  return now;
};

const loadIdleConversations = async (
  organizationId: number,
  conversationIds: number[],
  idleBefore: string,
) => {
  const admin = getSupabaseAdminClient();
  const withPreview = await admin
    .from("conversations")
    .select(
      "id, organization_id, mode, status, last_message_at, last_message_direction, last_message_preview, metadata, contact_id, contacts(full_name)",
    )
    .eq("organization_id", organizationId)
    .in("id", conversationIds)
    .neq("status", "resolved")
    .lte("last_message_at", idleBefore)
    .limit(MAX_PER_ORG * 2);

  if (
    withPreview.error?.message &&
    /last_message_direction|last_message_preview/i.test(withPreview.error.message)
  ) {
    return admin
      .from("conversations")
      .select("id, organization_id, mode, status, last_message_at, metadata, contact_id, contacts(full_name)")
      .eq("organization_id", organizationId)
      .in("id", conversationIds)
      .neq("status", "resolved")
      .lte("last_message_at", idleBefore)
      .limit(MAX_PER_ORG * 2);
  }

  return withPreview;
};

const recoverConversation = async (
  settings: AgentSettings,
  conversation: ConversationRow,
): Promise<RecoverOutcome> => {
  if (conversation.status === "resolved") {
    return "skipped";
  }

  const admin = getSupabaseAdminClient();
  const { data: messageRows } = await admin
    .from("messages")
    .select("direction, sender_type, content")
    .eq("organization_id", settings.organizationId)
    .eq("conversation_id", conversation.id)
    .neq("sender_type", "system")
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);

  const history = [...(messageRows ?? [])].reverse();
  if (!history.length || history[history.length - 1]?.direction !== "inbound") {
    return "skipped";
  }

  const contents = contentsFromPlainHistory(history);

  if (!contents.length) {
    return "skipped";
  }

  await markRecoveryAttempt(settings.organizationId, conversation.id, conversation.metadata);

  const now = new Date().toISOString();
  await admin
    .from("conversations")
    .update({
      mode: "ai",
      assigned_user_id: null,
      assigned_at: null,
      status: "in_progress",
      updated_at: now,
    })
    .eq("id", conversation.id)
    .eq("organization_id", settings.organizationId);

  const contactName = contactNameFromRow(conversation);
  const customPrompt = settings.leadRecoveryPrompt.trim() || LEAD_RECOVERY_DEFAULT_PROMPT;
  const outcome = await generateGeminiTurn({
    preferredModel: settings.model,
    systemInstruction: `${customPrompt}

Contacto: ${contactName}.
Último preview: ${conversation.last_message_preview || "sin texto"}.
Responde solo el mensaje para el cliente.`,
    contents,
    tools: [],
  });

  if (!outcome.ok || !outcome.text.trim()) {
    logMetaWebhook("warn", "agent.lead_recovery_generate_failed", {
      organizationId: settings.organizationId,
      conversationId: conversation.id,
      error: outcome.ok ? "empty_text" : outcome.error,
    });
    return "failed";
  }

  await insertSystemMessage({
    organizationId: settings.organizationId,
    conversationId: conversation.id,
    content: "La IA retomó el chat por inactividad.",
  });

  const sent = await sendAiOutboundMessage({
    organizationId: settings.organizationId,
    conversationId: conversation.id,
    text: outcome.text.trim(),
    metadata: { source: "lead_recovery" },
  });

  if (!sent.ok) {
    logMetaWebhook("warn", "agent.lead_recovery_send_failed", {
      organizationId: settings.organizationId,
      conversationId: conversation.id,
      error: sent.error,
    });
    return "failed";
  }

  return "recovered";
};

export const recoverIdleLeadConversations = async (): Promise<{
  recovered: number;
  skipped: number;
  failed: number;
}> => {
  const result = { recovered: 0, skipped: 0, failed: 0 };
  const admin = getSupabaseAdminClient();
  const { data: settingRows, error } = await admin
    .from("organization_agent_settings")
    .select("organization_id, enabled, lead_recovery_enabled")
    .eq("enabled", true)
    .eq("lead_recovery_enabled", true)
    .limit(MAX_ORGS);

  if (error) {
    if (/lead_recovery/i.test(error.message ?? "")) {
      logMetaWebhook("warn", "agent.lead_recovery_schema_missing", { error: error.message });
      return result;
    }
    throw error;
  }

  for (const row of (settingRows ?? []) as SettingsRow[]) {
    const settings = await loadAgentSettings(row.organization_id);
    if (!settings.enabled || !settings.leadRecoveryEnabled) {
      result.skipped += 1;
      continue;
    }

    if (settings.leadRecoveryRespectHours && !areAdvisorsAvailable(settings.businessHours)) {
      result.skipped += 1;
      continue;
    }

    const stageId = await resolveRecoveryStageId(row.organization_id, settings);
    if (!stageId) {
      result.skipped += 1;
      continue;
    }

    const idleHours = settings.leadRecoveryIdleHours || LEAD_RECOVERY_IDLE_HOURS_DEFAULT;
    const idleBefore = hoursAgo(idleHours);

    const { data: cards } = await admin
      .from("funnel_cards")
      .select("conversation_id, contact_id")
      .eq("organization_id", row.organization_id)
      .eq("stage_id", stageId)
      .not("conversation_id", "is", null)
      .limit(40);

    const conversationIds = [...new Set(
      ((cards ?? []) as FunnelCardRow[])
        .map((card) => card.conversation_id)
        .filter((id): id is number => typeof id === "number" && id > 0),
    )];

    if (!conversationIds.length) {
      continue;
    }

    const conversationsResult = await loadIdleConversations(
      row.organization_id,
      conversationIds,
      idleBefore,
    );

    const eligible = ((conversationsResult.data ?? []) as ConversationRow[]).filter((conversation) => {
      if (conversation.last_message_direction && conversation.last_message_direction !== "inbound") {
        return false;
      }
      if (isWithinCooldown(conversation.metadata, settings.leadRecoveryCooldownHours)) {
        return false;
      }
      return true;
    });

    for (const conversation of eligible.slice(0, MAX_PER_ORG)) {
      try {
        const outcome = await recoverConversation(settings, conversation);
        result[outcome] += 1;
      } catch (error) {
        result.failed += 1;
        logMetaWebhook("error", "agent.lead_recovery_conversation_failed", {
          organizationId: row.organization_id,
          conversationId: conversation.id,
          error: error instanceof Error ? error.message : "unknown",
        });
      }
    }
  }

  return result;
};
