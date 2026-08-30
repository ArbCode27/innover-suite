"use server";

import { redirect } from "next/navigation";
import { getAuthErrorCode, getAuthErrorMessage } from "@/lib/auth/errors";
import { loginPathWithNext } from "@/lib/auth/return-path";
import { inviteSignUpSchema } from "@/lib/auth/schema";
import { EMAIL_NOT_CONFIRMED_CODE } from "@/lib/auth/session-result";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { recordAuditEvent } from "@/lib/organizations/audit";

export type InvitePreview = {
  token: string;
  email: string;
  role: string;
  organizationName: string;
  expiresAt: string;
};

export const loadInvitePreview = async (token: string): Promise<InvitePreview | null> => {
  const admin = getSupabaseAdminClient();
  const { data } = await admin
    .from("organization_invitations")
    .select("token, email, role, expires_at, accepted_at, organizations(name)")
    .eq("token", token)
    .maybeSingle();

  if (!data?.token || data.accepted_at) return null;
  if (new Date(data.expires_at as string).getTime() < Date.now()) return null;

  const org = data.organizations as { name?: string } | { name?: string }[] | null;
  const organizationName = Array.isArray(org) ? org[0]?.name : org?.name;

  return {
    token: data.token as string,
    email: data.email as string,
    role: data.role as string,
    organizationName: organizationName || "Organización",
    expiresAt: data.expires_at as string,
  };
};

const acceptInvite = async (token: string, userId: string, email: string) => {
  const admin = getSupabaseAdminClient();
  const { data: invite } = await admin
    .from("organization_invitations")
    .select("id, organization_id, email, role, accepted_at, expires_at")
    .eq("token", token)
    .maybeSingle();

  if (!invite?.id || invite.accepted_at) {
    return { error: "Esta invitación ya no está disponible." };
  }

  if (new Date(invite.expires_at as string).getTime() < Date.now()) {
    return { error: "La invitación expiró. Pide una nueva." };
  }

  if (String(invite.email).toLowerCase() !== email.toLowerCase()) {
    return { error: "Entra con el mismo correo al que se envió la invitación." };
  }

  const { error: memberError } = await admin.from("organization_members").upsert(
    {
      organization_id: invite.organization_id,
      user_id: userId,
      role: invite.role,
      status: "active",
    },
    { onConflict: "organization_id,user_id" },
  );

  if (memberError) {
    return { error: memberError.message || "No se pudo unir a la organización." };
  }

  await admin
    .from("organization_invitations")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", invite.id);

  await recordAuditEvent({
    organizationId: invite.organization_id as number,
    actorUserId: userId,
    action: "invite.accept",
    entity: "invitation",
    entityId: invite.id,
  });

  return { ok: true as const };
};

export const acceptInviteAction = async (token: string) => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const email = user?.email;
  if (!user || !email) {
    redirect(loginPathWithNext(`/invite/${token}`));
  }

  const result = await acceptInvite(token, user.id, email);
  if ("error" in result) return result;
  redirect("/home");
};

export const signUpAndAcceptInviteAction = async (rawValues: unknown) => {
  const parsed = inviteSignUpSchema.safeParse(rawValues);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  }

  const invite = await loadInvitePreview(parsed.data.token);
  if (!invite) {
    return { error: "La invitación no es válida o expiró." };
  }

  if (invite.email.toLowerCase() !== parsed.data.email.toLowerCase()) {
    return { error: "Usa el correo de la invitación." };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return {
      error: getAuthErrorMessage(error.message, "No se pudo crear la cuenta."),
      code: getAuthErrorCode(error.message),
    };
  }

  if (!data.user) {
    return { error: "No se pudo crear la cuenta." };
  }

  if (!data.session) {
    return {
      success: "Cuenta creada. Confirma tu correo y luego entra para unirte al equipo.",
      code: EMAIL_NOT_CONFIRMED_CODE,
    };
  }

  const result = await acceptInvite(parsed.data.token, data.user.id, parsed.data.email);
  if ("error" in result) return result;
  redirect("/home");
};
