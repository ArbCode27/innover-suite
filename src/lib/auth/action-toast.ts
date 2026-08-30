"use client";

import { toast } from "sonner";
import { redirectIfSessionExpired } from "@/lib/auth/session-client";

type ActionErrorResult = {
  code?: string;
  error?: string;
} | null | undefined;

export const toastActionError = (result: ActionErrorResult) => {
  if (!result?.error) {
    return false;
  }

  if (redirectIfSessionExpired(result)) {
    return true;
  }

  toast.error(result.error);
  return true;
};
