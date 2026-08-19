"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentMembership, hasOrganizationRole } from "@/lib/organizations/membership";

const createOrganizationSchema = z.object({
  name: z.string().trim().min(3, "El nombre de la organización debe tener al menos 3 caracteres"),
});

const inviteAdvisorSchema = z.object({
  email: z.email("Ingresa un correo válido"),
  role: z.enum(["admin", "agent", "viewer"]),
});

const connectInstagramSchema = z.object({
  instagramAccountId: z.string().trim().min(2, "Ingresa un identificador válido"),
  displayName: z.string().trim().min(2, "Ingresa un nombre para la cuenta"),
});

export const createOrganizationAction = async (rawValues: unknown) => {
  const parsed = createOrganizationSchema.safeParse(rawValues);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Tu sesión expiró. Inicia sesión nuevamente." };
  }

  const { error } = await supabase.rpc("create_organization_for_current_user", {
    org_name: parsed.data.name,
  });

  if (error) {
    return { error: error.message || "No se pudo crear la organización" };
  }

  redirect("/inbox");
};

export const inviteAdvisorAction = async (rawValues: unknown) => {
  const parsed = inviteAdvisorSchema.safeParse(rawValues);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const membership = await getCurrentMembership();
  if (!membership || !hasOrganizationRole(membership, ["owner", "admin"])) {
    return { error: "No tienes permisos para invitar asesores." };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Tu sesión expiró. Inicia sesión nuevamente." };
  }

  const { error } = await supabase.from("organization_invitations").upsert(
    {
      organization_id: membership.organizationId,
      email: parsed.data.email.toLowerCase(),
      role: parsed.data.role,
      invited_by_user_id: user.id,
      accepted_at: null,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
    { onConflict: "organization_id,email" },
  );

  if (error) {
    return { error: error.message || "No se pudo guardar la invitación" };
  }

  revalidatePath("/settings");
  return { success: "Invitación registrada. Comparte el enlace de onboarding al asesor." };
};

export const connectInstagramAccountAction = async (rawValues: unknown) => {
  const parsed = connectInstagramSchema.safeParse(rawValues);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const membership = await getCurrentMembership();
  if (!membership || !hasOrganizationRole(membership, ["owner", "admin"])) {
    return { error: "No tienes permisos para conectar cuentas." };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Tu sesión expiró. Inicia sesión nuevamente." };
  }

  const { error } = await supabase.from("channel_accounts").upsert(
    {
      organization_id: membership.organizationId,
      channel: "instagram",
      external_account_id: parsed.data.instagramAccountId,
      display_name: parsed.data.displayName,
      connected_by_user_id: user.id,
    },
    { onConflict: "channel,external_account_id" },
  );

  if (error) {
    return { error: error.message || "No se pudo vincular la cuenta de Instagram" };
  }

  revalidatePath("/settings");
  return { success: "Cuenta de Instagram vinculada correctamente." };
};
