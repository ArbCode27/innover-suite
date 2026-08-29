import { cache } from "react";
import { AGENT_MODEL, DEFAULT_AGENT_PROMPT, RETIRED_AGENT_MODELS } from "@/lib/agent/constants";
import { DEFAULT_BUSINESS_HOURS, DEFAULT_CLOSED_MESSAGE, parseBusinessHours, type BusinessHours } from "@/lib/agent/hours";
import type { AgentSettings } from "@/lib/agent/types";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

type SettingsRow = {
  organization_id: number;
  enabled: boolean;
  system_prompt: string;
  model: string;
  tools_calendar: boolean;
  tools_funnel: boolean;
  tools_handoff: boolean;
  require_booking_confirmation: boolean;
  language: string;
  business_hours?: unknown;
  closed_message?: string | null;
};

const mapSettings = (row: SettingsRow): AgentSettings => ({
  organizationId: row.organization_id,
  enabled: row.enabled,
  systemPrompt:
    !row.system_prompt?.trim() || row.system_prompt.includes("español dominicano")
      ? DEFAULT_AGENT_PROMPT
      : row.system_prompt,
  model: row.model && !RETIRED_AGENT_MODELS.has(row.model) ? row.model : AGENT_MODEL,
  toolsCalendar: row.tools_calendar,
  toolsFunnel: row.tools_funnel,
  toolsHandoff: row.tools_handoff,
  requireBookingConfirmation: row.require_booking_confirmation,
  language: row.language || "es-VE",
  businessHours: parseBusinessHours(row.business_hours),
  closedMessage: row.closed_message?.trim() || DEFAULT_CLOSED_MESSAGE,
});

export const getDefaultAgentSettings = (organizationId: number): AgentSettings => ({
  organizationId,
  enabled: true,
  systemPrompt: DEFAULT_AGENT_PROMPT,
  model: AGENT_MODEL,
  toolsCalendar: true,
  toolsFunnel: true,
  toolsHandoff: true,
  requireBookingConfirmation: true,
  language: "es-VE",
  businessHours: DEFAULT_BUSINESS_HOURS,
  closedMessage: DEFAULT_CLOSED_MESSAGE,
});

export const loadAgentSettings = cache(async (organizationId: number): Promise<AgentSettings> => {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("organization_agent_settings")
    .select(
      "organization_id, enabled, system_prompt, model, tools_calendar, tools_funnel, tools_handoff, require_booking_confirmation, language, business_hours, closed_message",
    )
    .eq("organization_id", organizationId)
    .maybeSingle<SettingsRow>();

  if (error) {
    const fallback = await admin
      .from("organization_agent_settings")
      .select(
        "organization_id, enabled, system_prompt, model, tools_calendar, tools_funnel, tools_handoff, require_booking_confirmation, language",
      )
      .eq("organization_id", organizationId)
      .maybeSingle<SettingsRow>();
    if (fallback.error || !fallback.data) {
      return getDefaultAgentSettings(organizationId);
    }
    return mapSettings(fallback.data);
  }

  if (!data) {
    return getDefaultAgentSettings(organizationId);
  }

  return mapSettings(data);
});

export const upsertAgentSettings = async (
  organizationId: number,
  userId: string,
  values: Omit<AgentSettings, "organizationId">,
) => {
  const admin = getSupabaseAdminClient();
  const payload: Record<string, unknown> = {
    organization_id: organizationId,
    enabled: values.enabled,
    system_prompt: values.systemPrompt,
    model: values.model,
    tools_calendar: values.toolsCalendar,
    tools_funnel: values.toolsFunnel,
    tools_handoff: values.toolsHandoff,
    require_booking_confirmation: values.requireBookingConfirmation,
    language: values.language,
    business_hours: values.businessHours,
    closed_message: values.closedMessage,
    updated_by_user_id: userId,
  };

  const { error } = await admin.from("organization_agent_settings").upsert(payload);
  if (!error) return error;

  delete payload.business_hours;
  delete payload.closed_message;
  const fallback = await admin.from("organization_agent_settings").upsert(payload);
  return fallback.error;
};

export type KnowledgeArticle = {
  id: number;
  title: string;
  body: string;
  active: boolean;
  imageUrl: string | null;
  useWhen: string | null;
};

const mapKnowledgeArticle = (row: {
  id: number;
  title: string;
  body: string;
  active: boolean;
  image_url?: string | null;
  use_when?: string | null;
}): KnowledgeArticle => ({
  id: row.id,
  title: row.title,
  body: row.body,
  active: row.active,
  imageUrl: typeof row.image_url === "string" && row.image_url.trim() ? row.image_url.trim() : null,
  useWhen: typeof row.use_when === "string" && row.use_when.trim() ? row.use_when.trim() : null,
});

export const loadKnowledgeArticles = async (organizationId: number, activeOnly = true) => {
  const admin = getSupabaseAdminClient();
  let request = admin
    .from("knowledge_articles")
    .select("id, title, body, active, image_url, use_when")
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false })
    .limit(40);

  if (activeOnly) {
    request = request.eq("active", true);
  }

  const { data, error } = await request;
  if (error) {
    const fallback = admin
      .from("knowledge_articles")
      .select("id, title, body, active")
      .eq("organization_id", organizationId)
      .order("updated_at", { ascending: false })
      .limit(40);
    const withoutImages = activeOnly ? fallback.eq("active", true) : fallback;
    const result = await withoutImages;
    if (result.error) return [] as KnowledgeArticle[];
    return (result.data ?? []).map((row) => mapKnowledgeArticle(row));
  }

  return (data ?? []).map((row) => mapKnowledgeArticle(row));
};

export const formatKnowledgeContext = (articles: KnowledgeArticle[]) => {
  if (!articles.length) return "";
  const preview = articles.slice(0, 20);
  const lines = preview
    .map((article) => `- ${article.title}: ${article.body.trim().slice(0, 500)}`)
    .join("\n");
  const imageLines = preview
    .filter((article) => article.imageUrl)
    .map((article) => {
      const hint = article.useWhen ? ` Úsala si: ${article.useWhen}.` : "";
      return `- [assetId:${article.id}] ${article.title}.${hint}`;
    })
    .join("\n");
  const imageBlock = imageLines
    ? `\nImágenes que puedes enviar (solo estos assetId; llama send_image; no inventes URLs; máximo 1 por respuesta):\n${imageLines}`
    : "";
  return `Base de conocimiento (úsalas para responder FAQs; no inventes políticas que no estén aquí):\n${lines}${imageBlock}`;
};

export type { BusinessHours };
