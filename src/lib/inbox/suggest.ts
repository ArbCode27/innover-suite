"use server";

import { z } from "zod";
import { generateGeminiTurn } from "@/lib/agent/gemini";
import { contentsFromPlainHistory } from "@/lib/agent/history";
import { loadAgentSettings } from "@/lib/agent/settings";
import { getCurrentMembership, hasOrganizationRole } from "@/lib/organizations/membership";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const suggestReplyAction = async (rawValues: unknown) => {
  const parsed = z.object({ conversationId: z.number().int().positive() }).safeParse(rawValues);
  if (!parsed.success) {
    return { error: "La conversación no es válida." };
  }

  const membership = await getCurrentMembership();
  if (!membership || !hasOrganizationRole(membership, ["owner", "admin", "agent"])) {
    return { error: "No tienes permisos para sugerir respuestas." };
  }

  const supabase = await createSupabaseServerClient();
  const { data: messages, error } = await supabase
    .from("messages")
    .select("direction, sender_type, content")
    .eq("organization_id", membership.organizationId)
    .eq("conversation_id", parsed.data.conversationId)
    .neq("sender_type", "system")
    .order("created_at", { ascending: false })
    .limit(16);

  if (error) {
    return { error: error.message || "No se pudo leer el historial." };
  }

  const history = [...(messages ?? [])].reverse();
  const contents = contentsFromPlainHistory(history);

  if (!contents.length) {
    return { error: "No hay texto suficiente para sugerir una respuesta." };
  }

  const settings = await loadAgentSettings(membership.organizationId);
  const outcome = await generateGeminiTurn({
    preferredModel: settings.model,
    systemInstruction: `${settings.systemPrompt}

Redacta UNA respuesta corta en español para que un asesor humano la envíe ahora. No menciones que eres IA. No uses tools. No hagas preguntas de más.`,
    contents,
    tools: [],
  });

  if (!outcome.ok || !outcome.text) {
    return { error: outcome.ok ? "El modelo no devolvió texto." : outcome.error };
  }

  return { success: "Sugerencia lista.", reply: outcome.text };
};
