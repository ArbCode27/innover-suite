import { EMAIL_NOT_CONFIRMED_CODE } from "@/lib/auth/session-result";

export const isEmailNotConfirmedMessage = (message: string) =>
  message.toLowerCase().includes("email not confirmed");

export const getAuthErrorMessage = (message: string, fallback = "No se pudo iniciar sesión. Inténtalo de nuevo.") => {
  const normalized = message.toLowerCase();

  if (normalized.includes("invalid login credentials")) {
    return "Correo o contraseña incorrectos.";
  }

  if (isEmailNotConfirmedMessage(message)) {
    return "Confirma tu correo antes de iniciar sesión.";
  }

  if (normalized.includes("too many requests") || normalized.includes("rate limit") || normalized.includes("over_email_send_rate")) {
    return "Demasiados intentos. Espera un momento e inténtalo de nuevo.";
  }

  if (normalized.includes("user already registered") || normalized.includes("already been registered")) {
    return "Ya existe una cuenta con este correo. Entra con tu contraseña.";
  }

  if (
    normalized.includes("should be different") ||
    normalized.includes("same password") ||
    normalized.includes("different from the old")
  ) {
    return "La nueva contraseña debe ser distinta a la actual.";
  }

  if (normalized.includes("weak") || normalized.includes("pwned")) {
    return "Elige una contraseña más segura.";
  }

  return fallback;
};

export const getAuthErrorCode = (message: string) => {
  if (isEmailNotConfirmedMessage(message)) {
    return EMAIL_NOT_CONFIRMED_CODE;
  }

  return undefined;
};
