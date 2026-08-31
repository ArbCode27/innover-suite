import { isSafeReturnPath } from "@/lib/auth/return-path";

export const isSafeIntegrationReturnPath = (value: string | null | undefined): value is string => {
  if (!isSafeReturnPath(value)) return false;
  try {
    const parsed = new URL(value, "http://innover.local");
    return parsed.pathname === "/settings" || parsed.pathname === "/onboarding/setup";
  } catch {
    return false;
  }
};

export const resolveIntegrationReturnPath = (returnPath?: string | null) =>
  isSafeIntegrationReturnPath(returnPath) ? returnPath : "/settings";

export const oauthStartHref = (startPath: string, step: "channel" | "calendar") =>
  `${startPath}?next=${encodeURIComponent(`/onboarding/setup?step=${step}`)}`;
