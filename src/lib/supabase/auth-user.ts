import type { User } from "@supabase/supabase-js";

export const AUTH_TIMEOUT_MS = 8000;

type AuthGetUserClient = {
  auth: {
    getUser: () => Promise<{ data: { user: User | null } }>;
  };
};

export const getAuthUserWithTimeout = async (
  client: AuthGetUserClient,
): Promise<{ user: User | null; timedOut: boolean }> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => resolve("timeout"), AUTH_TIMEOUT_MS);
  });

  try {
    const result = await Promise.race([client.auth.getUser(), timeout]);
    if (result === "timeout") {
      return { user: null, timedOut: true };
    }
    return { user: result.data.user, timedOut: false };
  } catch {
    return { user: null, timedOut: true };
  } finally {
    if (timer) clearTimeout(timer);
  }
};
