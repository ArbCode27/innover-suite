const SAFE_RETURN_PREFIXES = [
  "/home",
  "/inbox",
  "/invite",
  "/settings",
  "/orders",
  "/inventory",
  "/funnels",
  "/calendar",
  "/listings",
  "/contacts",
  "/onboarding",
  "/print",
] as const;

export const LOGIN_RESET_PATH = "/login/reset";
export const AUTH_CONFIRM_PATH = "/auth/confirm";
export const PASSWORD_RECOVERY_COOKIE = "innover-password-recovery";

const hasUnsafeChars = (value: string) =>
  value.includes("://") || value.includes("//") || value.includes("\\");

const parseAppPath = (value: string) => {
  if (!value.startsWith("/") || hasUnsafeChars(value)) {
    return null;
  }

  try {
    const parsed = new URL(value, "http://innover.local");
    if (parsed.username || parsed.password || parsed.host !== "innover.local") {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
};

export const isSafeWhatsAppOAuthReturnPath = (value: string | null | undefined): value is string => {
  if (!value || !value.startsWith("/api/auth/whatsapp/callback")) {
    return false;
  }

  const parsed = parseAppPath(value);
  return parsed?.pathname === "/api/auth/whatsapp/callback";
};

export const isSafeReturnPath = (value: string | null | undefined): value is string => {
  if (!value) {
    return false;
  }

  const parsed = parseAppPath(value);
  if (!parsed) {
    return false;
  }

  return SAFE_RETURN_PREFIXES.some(
    (prefix) => parsed.pathname === prefix || parsed.pathname.startsWith(`${prefix}/`),
  );
};

export const isAuthCallbackNext = (value: string | null | undefined): value is string =>
  value === LOGIN_RESET_PATH || isSafeReturnPath(value);

export const resolvePostAuthPath = (nextPath?: string | null) => {
  if (isSafeWhatsAppOAuthReturnPath(nextPath)) {
    return nextPath;
  }

  if (isSafeReturnPath(nextPath)) {
    return nextPath;
  }

  return "/home";
};

export const loginPathWithNext = (next: string) => {
  if (!isSafeReturnPath(next)) {
    return "/login";
  }

  return `/login?next=${encodeURIComponent(next)}`;
};
