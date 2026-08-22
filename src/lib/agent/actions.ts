"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AGENT_MODEL, DEFAULT_AGENT_PROMPT } from "@/lib/agent/constants";
import { upsertAgentSettings } from "@/lib/agent/settings";
import { getCurrentMembership, hasOrganizationRole } from "@/lib/organizations/membership";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const saveAgentSettingsSchema = z.object({
  enabled: z.boolean(),
  systemPrompt: z.string().trim().min(40).max(8000),
  toolsCalendar: z.boolean(),
  toolsFunnel: z.boolean(),
  toolsHandoff: z.boolean(),
  requireBookingConfirmation: z.boolean(),
});

type ActionResult = {
  success?: string;
  error?: string;
};

export const saveAgentSettingsAction = async (rawValues: unknown): Promise<ActionResult> => {
  const parsed = saveAgentSettingsSchema.safeParse(rawValues);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa el prompt del agente (mínimo 40 caracteres)." };
  }

  const membership = await getCurrentMembership();
  if (!membership || !hasOrganizationRole(membership, ["owner", "admin"])) {
    return { error: "Solo owner o admin pueden configurar el agente." };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Tu sesión expiró. Inicia sesión nuevamente." };
  }

  const error = await upsertAgentSettings(membership.organizationId, user.id, {
    enabled: parsed.data.enabled,
    systemPrompt: parsed.data.systemPrompt || DEFAULT_AGENT_PROMPT,
    model: AGENT_MODEL,
    toolsCalendar: parsed.data.toolsCalendar,
    toolsFunnel: parsed.data.toolsFunnel,
    toolsHandoff: parsed.data.toolsHandoff,
    requireBookingConfirmation: parsed.data.requireBookingConfirmation,
    language: "es-DO",
  });

  if (error) {
    console.error("[AGENT] save settings failed", error);
    return { error: "No se pudo guardar la configuración del agente. ¿Corriste el SQL de agent-upgrade?" };
  }

  revalidatePath("/settings");
  return { success: "Configuración del agente guardada." };
};
