import { AGENT_MODEL, DEFAULT_AGENT_PROMPT, RETIRED_AGENT_MODELS } from "@/lib/agent/constants";
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
};

const mapSettings = (row: SettingsRow): AgentSettings => ({
  organizationId: row.organization_id,
  enabled: row.enabled,
  systemPrompt: row.system_prompt || DEFAULT_AGENT_PROMPT,
  model: row.model && !RETIRED_AGENT_MODELS.has(row.model) ? row.model : AGENT_MODEL,
  toolsCalendar: row.tools_calendar,
  toolsFunnel: row.tools_funnel,
  toolsHandoff: row.tools_handoff,
  requireBookingConfirmation: row.require_booking_confirmation,
  language: row.language || "es-DO",
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
  language: "es-DO",
});

export const loadAgentSettings = async (organizationId: number): Promise<AgentSettings> => {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("organization_agent_settings")
    .select(
      "organization_id, enabled, system_prompt, model, tools_calendar, tools_funnel, tools_handoff, require_booking_confirmation, language",
    )
    .eq("organization_id", organizationId)
    .maybeSingle<SettingsRow>();

  if (error || !data) {
    return getDefaultAgentSettings(organizationId);
  }

  return mapSettings(data);
};

export const upsertAgentSettings = async (
  organizationId: number,
  userId: string,
  values: Omit<AgentSettings, "organizationId">,
) => {
  const admin = getSupabaseAdminClient();
  const { error } = await admin.from("organization_agent_settings").upsert({
    organization_id: organizationId,
    enabled: values.enabled,
    system_prompt: values.systemPrompt,
    model: values.model,
    tools_calendar: values.toolsCalendar,
    tools_funnel: values.toolsFunnel,
    tools_handoff: values.toolsHandoff,
    require_booking_confirmation: values.requireBookingConfirmation,
    language: values.language,
    updated_by_user_id: userId,
  });

  return error;
};
