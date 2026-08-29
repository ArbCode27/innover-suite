"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AGENT_MODEL, AGENT_PROMPT_MAX_CHARS, DEFAULT_AGENT_PROMPT } from "@/lib/agent/constants";
import { DEFAULT_CLOSED_MESSAGE, parseBusinessHours } from "@/lib/agent/hours";
import { loadAgentSettings, upsertAgentSettings } from "@/lib/agent/settings";
import { getCurrentMembership, hasOrganizationRole } from "@/lib/organizations/membership";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const weekdaySchema = z
  .object({
    open: z.string().regex(/^\d{2}:\d{2}$/),
    close: z.string().regex(/^\d{2}:\d{2}$/),
  })
  .nullable();

const saveAgentSettingsSchema = z.object({
  enabled: z.boolean(),
  systemPrompt: z
    .string()
    .trim()
    .min(40, "El prompt debe tener al menos 40 caracteres.")
    .max(AGENT_PROMPT_MAX_CHARS, `El prompt no puede superar ${AGENT_PROMPT_MAX_CHARS.toLocaleString("es-VE")} caracteres.`),
  toolsCalendar: z.boolean(),
  toolsFunnel: z.boolean(),
  toolsHandoff: z.boolean(),
  requireBookingConfirmation: z.boolean(),
  closedMessage: z.string().trim().max(500).optional(),
  businessHours: z
    .object({
      timezone: z.string().optional(),
      enabled: z.boolean().optional(),
      afterHoursAiCoverage: z.boolean().optional(),
      days: z.record(z.string(), weekdaySchema),
    })
    .optional(),
});

const saveOfficeHoursSchema = z.object({
  closedMessage: z.string().trim().max(500).optional(),
  businessHours: z.object({
    timezone: z.string().optional(),
    enabled: z.boolean().optional(),
    afterHoursAiCoverage: z.boolean().optional(),
    days: z.record(z.string(), weekdaySchema),
  }),
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

  const current = await loadAgentSettings(membership.organizationId);
  const error = await upsertAgentSettings(membership.organizationId, user.id, {
    enabled: parsed.data.enabled,
    systemPrompt: parsed.data.systemPrompt || DEFAULT_AGENT_PROMPT,
    model: AGENT_MODEL,
    toolsCalendar: parsed.data.toolsCalendar,
    toolsFunnel: parsed.data.toolsFunnel,
    toolsHandoff: parsed.data.toolsHandoff,
    requireBookingConfirmation: parsed.data.requireBookingConfirmation,
    language: "es-VE",
    businessHours: parsed.data.businessHours
      ? parseBusinessHours(parsed.data.businessHours)
      : current.businessHours,
    closedMessage: parsed.data.closedMessage?.trim() || current.closedMessage,
  });

  if (error) {
    console.error("[AGENT] save settings failed", error);
    return { error: "No se pudo guardar la configuración del agente. ¿Corriste el SQL de agent-upgrade?" };
  }

  revalidatePath("/settings");
  return { success: "Configuración del agente guardada." };
};

export const saveOfficeHoursAction = async (rawValues: unknown): Promise<ActionResult> => {
  const parsed = saveOfficeHoursSchema.safeParse(rawValues);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa el horario de oficina." };
  }

  const membership = await getCurrentMembership();
  if (!membership || !hasOrganizationRole(membership, ["owner", "admin"])) {
    return { error: "Solo owner o admin pueden configurar el horario de oficina." };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Tu sesión expiró. Inicia sesión nuevamente." };
  }

  const current = await loadAgentSettings(membership.organizationId);
  const { organizationId: _organizationId, ...rest } = current;
  const error = await upsertAgentSettings(membership.organizationId, user.id, {
    ...rest,
    businessHours: parseBusinessHours(parsed.data.businessHours),
    closedMessage: parsed.data.closedMessage?.trim() || DEFAULT_CLOSED_MESSAGE,
  });

  if (error) {
    console.error("[AGENT] save office hours failed", error);
    return { error: "No se pudo guardar el horario de oficina. ¿Corriste el SQL de agent-upgrade?" };
  }

  revalidatePath("/settings");
  revalidatePath("/inbox");
  return { success: "Horario de oficina guardado." };
};

const knowledgeSchema = z.object({
  title: z.string().trim().min(3).max(120),
  body: z.string().trim().min(8).max(4000),
});

export const createKnowledgeArticleAction = async (rawValues: unknown): Promise<ActionResult> => {
  const parsed = knowledgeSchema.safeParse(rawValues);
  if (!parsed.success) {
    return { error: "Título y contenido son obligatorios." };
  }

  const membership = await getCurrentMembership();
  if (!membership || !hasOrganizationRole(membership, ["owner", "admin"])) {
    return { error: "Solo owner o admin pueden editar la base de conocimiento." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("knowledge_articles").insert({
    organization_id: membership.organizationId,
    title: parsed.data.title,
    body: parsed.data.body,
    active: true,
  });

  if (error) {
    return { error: error.message || "No se pudo guardar el artículo." };
  }

  revalidatePath("/settings");
  return { success: "Artículo publicado para el agente." };
};

export const toggleKnowledgeArticleAction = async (articleId: number, active: boolean): Promise<ActionResult> => {
  const membership = await getCurrentMembership();
  if (!membership || !hasOrganizationRole(membership, ["owner", "admin"])) {
    return { error: "Solo owner o admin pueden editar la base de conocimiento." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("knowledge_articles")
    .update({ active })
    .eq("id", articleId)
    .eq("organization_id", membership.organizationId);

  if (error) {
    return { error: error.message || "No se pudo actualizar el artículo." };
  }

  revalidatePath("/settings");
  return { success: active ? "Artículo activado." : "Artículo desactivado." };
};
