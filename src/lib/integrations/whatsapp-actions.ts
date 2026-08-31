"use server";

import { revalidatePath } from "next/cache";
import { sessionExpiredResult } from "@/lib/auth/session-result";
import {
  completeWhatsAppManualTokenConnect,
  type WhatsAppConnectStatus,
} from "@/lib/integrations/whatsapp";
import { connectWhatsAppWithTokenSchema } from "@/lib/integrations/whatsapp-schema";
import { recordAuditEvent } from "@/lib/organizations/audit";
import { getCurrentMembership, hasOrganizationRole } from "@/lib/organizations/membership";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { zodErrorMessage } from "@/lib/validation/zod-es";

const MANUAL_CONNECT_ERRORS: Partial<Record<WhatsAppConnectStatus, string>> = {
  invalid_token: "Meta rechazó el token. Usa un token de System User con permisos de WhatsApp.",
  invalid_phone: "No se pudo leer ese Phone Number ID con el token indicado.",
  waba_mismatch: "Ese número no pertenece al WABA ID que pegaste.",
  waba_required: "No se detectó la cuenta de WhatsApp Business. Pega el WABA ID.",
  no_numbers: "No se encontró ningún número de WhatsApp autorizado para conectar.",
  persist_failed: "El token es válido, pero no se pudo guardar la conexión en el CRM.",
  subscription_failed:
    "Se guardó el número, pero no se pudo suscribir el webhook. Revisa que el token tenga acceso al WABA.",
};

export const connectWhatsAppWithTokenAction = async (rawValues: unknown) => {
  const parsed = connectWhatsAppWithTokenSchema.safeParse(rawValues);
  if (!parsed.success) {
    return { error: zodErrorMessage(parsed.error, "Revisa los datos de WhatsApp.") };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return sessionExpiredResult();
  }

  const membership = await getCurrentMembership();
  if (!membership || !hasOrganizationRole(membership, ["owner", "admin"])) {
    return { error: "No tienes permisos para conectar WhatsApp." };
  }

  const status = await completeWhatsAppManualTokenConnect({
    organizationId: membership.organizationId,
    userId: user.id,
    accessToken: parsed.data.accessToken,
    phoneNumberId: parsed.data.phoneNumberId,
    wabaId: parsed.data.wabaId || undefined,
  });

  if (status !== "connected") {
    return {
      error: MANUAL_CONNECT_ERRORS[status] || "No se pudo conectar WhatsApp con esas credenciales.",
    };
  }

  await recordAuditEvent({
    organizationId: membership.organizationId,
    actorUserId: user.id,
    action: "whatsapp.connect_token",
    entity: "channel_account",
    entityId: parsed.data.phoneNumberId,
    payload: {
      provider: "whatsapp_system_user",
      wabaId: parsed.data.wabaId || null,
    },
  });

  revalidatePath("/settings");
  revalidatePath("/onboarding/setup");
  revalidatePath("/home");

  return { success: "WhatsApp conectado correctamente." };
};
