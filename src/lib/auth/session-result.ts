export const SESSION_EXPIRED_CODE = "session_expired" as const;
export const EMAIL_NOT_CONFIRMED_CODE = "email_not_confirmed" as const;
export const RECOVERY_EXPIRED_CODE = "recovery_expired" as const;

export type SessionExpiredResult = {
  error: string;
  code: typeof SESSION_EXPIRED_CODE;
};

export const sessionExpiredResult = (): SessionExpiredResult => ({
  code: SESSION_EXPIRED_CODE,
  error: "Tu sesión expiró. Inicia sesión nuevamente.",
});

export const isSessionExpiredResult = (
  result: unknown,
): result is SessionExpiredResult =>
  Boolean(
    result &&
      typeof result === "object" &&
      "code" in result &&
      result.code === SESSION_EXPIRED_CODE,
  );
