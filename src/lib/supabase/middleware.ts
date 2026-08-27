import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const AUTH_TIMEOUT_MS = 8000;

const PUBLIC_PATHS = [
  "/login",
  "/privacy",
  "/terms",
  "/invite",
  "/api/health",
  "/api/auth/instagram/callback",
  "/api/auth/messenger/callback",
  "/api/auth/whatsapp/callback",
  "/api/auth/google/callback",
  "/api/cron/instagram/refresh",
  "/api/cron/google/refresh",
  "/api/meta/webhook",
  "/api/webhooks/meta",
];

const AUTH_SKIP_PATHS = [
  "/privacy",
  "/terms",
  "/invite",
  "/api/health",
  "/api/auth/instagram/callback",
  "/api/auth/messenger/callback",
  "/api/auth/whatsapp/callback",
  "/api/auth/google/callback",
  "/api/cron/instagram/refresh",
  "/api/cron/google/refresh",
  "/api/meta/webhook",
  "/api/webhooks/meta",
];

const isPrefixedPath = (pathname: string, paths: string[]) =>
  paths.some((path) => pathname === path || pathname.startsWith(`${path}/`));

const isPublicPath = (pathname: string) => isPrefixedPath(pathname, PUBLIC_PATHS);

const shouldSkipAuth = (pathname: string) => isPrefixedPath(pathname, AUTH_SKIP_PATHS);

const isSafeWhatsAppOAuthReturnPath = (value: string | null) => {
  if (!value || !value.startsWith("/api/auth/whatsapp/callback")) {
    return false;
  }

  if (value.includes("://") || value.includes("//") || value.includes("\\")) {
    return false;
  }

  try {
    return new URL(value, "http://innover.local").pathname === "/api/auth/whatsapp/callback";
  } catch {
    return false;
  }
};

const hasSupabaseAuthCookie = (request: NextRequest) =>
  request.cookies.getAll().some((cookie) => cookie.name.includes("-auth-token"));

const copyCookies = (from: NextResponse, to: NextResponse) => {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie.name, cookie.value);
  });

  return to;
};

const redirectWithCookies = (
  request: NextRequest,
  sessionResponse: NextResponse,
  pathname: string,
) => {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";

  return copyCookies(sessionResponse, NextResponse.redirect(url));
};

const getUserWithTimeout = async (
  supabase: ReturnType<typeof createServerClient>,
): Promise<{ user: { id: string } | null; timedOut: boolean }> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => resolve("timeout"), AUTH_TIMEOUT_MS);
  });

  try {
    const result = await Promise.race([supabase.auth.getUser(), timeout]);
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

export const updateSession = async (request: NextRequest) => {
  const sessionResponse = NextResponse.next({ request });
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const { pathname } = request.nextUrl;

  if (shouldSkipAuth(pathname)) {
    return sessionResponse;
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    if (!isPublicPath(pathname)) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }

    return sessionResponse;
  }

  if (!hasSupabaseAuthCookie(request) && !isPublicPath(pathname)) {
    return redirectWithCookies(request, sessionResponse, "/login");
  }

  let response = sessionResponse;
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { user, timedOut } = await getUserWithTimeout(supabase);

  if (timedOut) {
    return response;
  }

  if (user && (pathname === "/login" || pathname === "/")) {
    const nextPath = request.nextUrl.searchParams.get("next");
    if (pathname === "/login" && nextPath && isSafeWhatsAppOAuthReturnPath(nextPath)) {
      const resumeUrl = request.nextUrl.clone();
      resumeUrl.pathname = "/api/auth/whatsapp/callback";
      resumeUrl.search = new URL(nextPath, request.nextUrl.origin).search;
      return copyCookies(response, NextResponse.redirect(resumeUrl));
    }

    return redirectWithCookies(request, response, "/home");
  }

  if (!user && !isPublicPath(pathname)) {
    return redirectWithCookies(request, response, "/login");
  }

  return response;
};
