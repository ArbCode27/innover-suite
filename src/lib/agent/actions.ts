"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AGENT_MODEL, AGENT_PROMPT_MAX_CHARS, DEFAULT_AGENT_PROMPT } from "@/lib/agent/constants";
import { DEFAULT_CLOSED_MESSAGE, parseBusinessHours } from "@/lib/agent/hours";
import { loadAgentSettings, upsertAgentSettings } from "@/lib/agent/settings";
import { getCurrentMembership, hasOrganizationRole } from "@/lib/organizations/membership";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sessionExpiredResult } from "@/lib/auth/session-result";
import { readCatalogImageFile } from "@/lib/media/image-upload";
import { buildKnowledgeImagePath, uploadPublicMedia } from "@/lib/media/storage";
import { KNOWLEDGE_IMAGES_BUCKET } from "@/lib/media/types";
import { zodErrorMessage } from "@/lib/validation/zod-es";

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
    return { error: zodErrorMessage(parsed.error, "Revisa el prompt del agente (mínimo 40 caracteres).") };
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
    return sessionExpiredResult();
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
  revalidatePath("/onboarding/setup");
  return { success: "Configuración del agente guardada." };
};

export const saveOfficeHoursAction = async (rawValues: unknown): Promise<ActionResult> => {
  const parsed = saveOfficeHoursSchema.safeParse(rawValues);
  if (!parsed.success) {
    return { error: zodErrorMessage(parsed.error, "Revisa el horario de oficina.") };
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
    return sessionExpiredResult();
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
  useWhen: z.string().trim().max(240).optional(),
});

export const createKnowledgeArticleAction = async (formData: FormData): Promise<ActionResult> => {
  const parsed = knowledgeSchema.safeParse({
    title: formData.get("title"),
    body: formData.get("body"),
    useWhen: formData.get("useWhen") || undefined,
  });
  if (!parsed.success) {
    return { error: "Título (mín. 3) y contenido (mín. 8 caracteres) son obligatorios." };
  }

  const membership = await getCurrentMembership();
  if (!membership || !hasOrganizationRole(membership, ["owner", "admin"])) {
    return { error: "Solo owner o admin pueden editar la base de conocimiento." };
  }

  const uploaded = await readCatalogImageFile(formData.get("image"));
  if ("error" in uploaded) {
    return { error: uploaded.error };
  }

  let imageUrl: string | null = null;
  let imagePath: string | null = null;
  let imageMime: string | null = null;

  if (uploaded.file) {
    imagePath = buildKnowledgeImagePath({
      organizationId: membership.organizationId,
      fileName: uploaded.file.fileName,
    });
    imageMime = uploaded.file.mimeType;
    try {
      imageUrl = await uploadPublicMedia({
        bucket: KNOWLEDGE_IMAGES_BUCKET,
        path: imagePath,
        bytes: uploaded.file.bytes,
        mimeType: imageMime,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo subir la imagen.";
      return {
        error: /bucket|not found|does not exist/i.test(message)
          ? "No se encontró el bucket knowledge-images. ¿Corriste supabase/storage-image-buckets.sql?"
          : message,
      };
    }
  }

  const supabase = await createSupabaseServerClient();
  const payload: Record<string, unknown> = {
    organization_id: membership.organizationId,
    title: parsed.data.title,
    body: parsed.data.body,
    active: true,
  };
  if (parsed.data.useWhen) payload.use_when = parsed.data.useWhen;
  if (imageUrl) {
    payload.image_url = imageUrl;
    payload.image_path = imagePath;
    payload.image_mime = imageMime;
  }

  const { error } = await supabase.from("knowledge_articles").insert(payload);

  if (error) {
    return {
      error: error.message?.includes("image_url")
        ? "No se pudo guardar la imagen. ¿Corriste supabase/knowledge-images.sql?"
        : error.message || "No se pudo guardar el artículo.",
    };
  }

  revalidatePath("/settings");
  return { success: imageUrl ? "Artículo e imagen publicados para el agente." : "Artículo publicado para el agente." };
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
