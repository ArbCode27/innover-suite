"use client";

import { SESSION_EXPIRED_CODE } from "@/lib/auth/session-result";
import { isSafeReturnPath } from "@/lib/auth/return-path";

type ActionErrorResult = {
  code?: string;
  error?: string;
} | null | undefined;

export const redirectIfSessionExpired = (result: ActionErrorResult) => {
  if (!result || result.code !== SESSION_EXPIRED_CODE) {
    return false;
  }

  const next = `${window.location.pathname}${window.location.search}`;
  const login = new URL("/login", window.location.origin);

  if (isSafeReturnPath(next)) {
    login.searchParams.set("next", next);
  }

  window.location.assign(login.href);
  return true;
};
