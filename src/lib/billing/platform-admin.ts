import { env } from "@/lib/config/env";

export const getPlatformAdminEmails = () =>
  (env.platformAdminEmails || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

export const isPlatformAdminEmail = (email: string | null | undefined) => {
  if (!email) return false;
  const allowlist = getPlatformAdminEmails();
  if (!allowlist.length) return false;
  return allowlist.includes(email.trim().toLowerCase());
};
