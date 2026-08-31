import { cookies } from "next/headers";
import { isSafeIntegrationReturnPath } from "@/lib/integrations/oauth-href";

export const OAUTH_RETURN_COOKIE = "innover-oauth-return";

export const rememberOAuthReturnPath = async (next: string | null | undefined) => {
  const store = await cookies();
  if (isSafeIntegrationReturnPath(next) && next.startsWith("/onboarding/setup")) {
    store.set(OAUTH_RETURN_COOKIE, next, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 600,
    });
    return;
  }

  store.delete(OAUTH_RETURN_COOKIE);
};

export const consumeOAuthReturnPath = async () => {
  const store = await cookies();
  const value = store.get(OAUTH_RETURN_COOKIE)?.value ?? null;
  store.delete(OAUTH_RETURN_COOKIE);
  return isSafeIntegrationReturnPath(value) ? value : null;
};
