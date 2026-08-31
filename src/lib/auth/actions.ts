"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAuthErrorCode, getAuthErrorMessage } from "@/lib/auth/errors";
import { getRequestOrigin } from "@/lib/auth/origin";
import {
  AUTH_CONFIRM_PATH,
  LOGIN_RESET_PATH,
  PASSWORD_RECOVERY_COOKIE,
  resolvePostAuthPath,
} from "@/lib/auth/return-path";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  resendConfirmationSchema,
  resetPasswordSchema,
} from "@/lib/auth/schema";
import { RECOVERY_EXPIRED_CODE, sessionExpiredResult } from "@/lib/auth/session-result";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { zodErrorMessage } from "@/lib/validation/zod-es";

const GENERIC_RESET_MESSAGE = "Si el correo está registrado, te enviamos un enlace para crear una nueva contraseña.";
const GENERIC_RESEND_MESSAGE = "Si el correo está pendiente de confirmación, te enviamos otro enlace.";

const clearRecoveryCookie = async () => {
  const cookieStore = await cookies();
  cookieStore.set(PASSWORD_RECOVERY_COOKIE, "", { path: "/", maxAge: 0 });
};

export const signIn = async (rawValues: unknown, nextPath?: string | null) => {
  const parsed = loginSchema.safeParse(rawValues);

  if (!parsed.success) {
    return {
      error: zodErrorMessage(parsed.error, "Revisa los datos del formulario."),
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return {
      error: getAuthErrorMessage(error.message),
      code: getAuthErrorCode(error.message),
    };
  }

  redirect(resolvePostAuthPath(nextPath));
};

export const requestPasswordReset = async (rawValues: unknown) => {
  const parsed = forgotPasswordSchema.safeParse(rawValues);

  if (!parsed.success) {
    return {
      error: zodErrorMessage(parsed.error, "Ingresa un correo válido."),
    };
  }

  const supabase = await createSupabaseServerClient();
  const origin = await getRequestOrigin();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}${AUTH_CONFIRM_PATH}?next=${encodeURIComponent(LOGIN_RESET_PATH)}`,
  });

  if (error) {
    console.error("[AUTH] reset password email failed", error.message);
  }

  return { success: GENERIC_RESET_MESSAGE };
};

export const updatePassword = async (rawValues: unknown) => {
  const parsed = resetPasswordSchema.safeParse(rawValues);

  if (!parsed.success) {
    return {
      error: zodErrorMessage(parsed.error, "Revisa los datos del formulario."),
    };
  }

  const cookieStore = await cookies();
  if (cookieStore.get(PASSWORD_RECOVERY_COOKIE)?.value !== "1") {
    return {
      error: "El enlace de recuperación expiró o ya se usó.",
      code: RECOVERY_EXPIRED_CODE,
    };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: "El enlace de recuperación expiró o ya se usó.",
      code: RECOVERY_EXPIRED_CODE,
    };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) {
    return { error: getAuthErrorMessage(error.message, "No se pudo actualizar la contraseña.") };
  }

  await clearRecoveryCookie();
  redirect("/home");
};

export const changePassword = async (rawValues: unknown) => {
  const parsed = changePasswordSchema.safeParse(rawValues);

  if (!parsed.success) {
    return {
      error: zodErrorMessage(parsed.error, "Revisa los datos del formulario."),
    };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return sessionExpiredResult();
  }

  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.currentPassword,
  });

  if (reauthError) {
    return { error: "La contraseña actual no es correcta." };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) {
    return { error: getAuthErrorMessage(error.message, "No se pudo actualizar la contraseña.") };
  }

  revalidatePath("/settings");
  return { success: "Contraseña actualizada." };
};

export const resendConfirmation = async (rawValues: unknown) => {
  const parsed = resendConfirmationSchema.safeParse(rawValues);

  if (!parsed.success) {
    return {
      error: zodErrorMessage(parsed.error, "Ingresa un correo válido."),
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: parsed.data.email,
  });

  if (error) {
    console.error("[AUTH] resend confirmation failed", error.message);
  }

  return { success: GENERIC_RESEND_MESSAGE };
};

export const signOut = async () => {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  await clearRecoveryCookie();
  redirect("/login");
};
