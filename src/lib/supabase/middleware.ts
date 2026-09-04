import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getAuthUserWithTimeout } from "@/lib/supabase/auth-user";
import {
  isSafeReturnPath,
  isSafeWhatsAppOAuthReturnPath,
} from "@/lib/auth/return-path";

const PUBLIC_PATHS = [
  "/",
  "/login",
  "/privacy",
  "/terms",
  "/invite",
  "/auth",
  "/api/health",
  "/api/auth/instagram/callback",
  "/api/auth/messenger/callback",
  "/api/auth/whatsapp/callback",
  "/api/auth/google/callback",
  "/api/cron/instagram/refresh",
  "/api/cron/google/refresh",
  "/api/cron/agent",
  "/api/meta/webhook",
  "/api/webhooks/meta",
];

const AUTH_SKIP_PATHS = [
  "/privacy",
  "/terms",
  "/invite",
  "/auth",
  "/api/health",
  "/api/auth/instagram/callback",
  "/api/auth/messenger/callback",
  "/api/auth/whatsapp/callback",
  "/api/auth/google/callback",
  "/api/cron/instagram/refresh",
  "/api/cron/google/refresh",
  "/api/cron/agent",
  "/api/meta/webhook",
  "/api/webhooks/meta",
];

const isPrefixedPath = (pathname: string, paths: string[]) =>
  paths.some((path) => pathname === path || pathname.startsWith(`${path}/`));

const isPublicPath = (pathname: string) =>
  isPrefixedPath(pathname, PUBLIC_PATHS);

const shouldSkipAuth = (pathname: string) =>
  isPrefixedPath(pathname, AUTH_SKIP_PATHS);

const hasSupabaseAuthCookie = (request: NextRequest) =>
  request.cookies
    .getAll()
    .some((cookie) => cookie.name.includes("-auth-token"));

const copyCookies = (from: NextResponse, to: NextResponse) => {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie.name, cookie.value);
  });

  return to;
};

const redirectTo = (
  request: NextRequest,
  sessionResponse: NextResponse,
  pathname: string,
  search = "",
) => {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = search;
  url.hash = "";

  return copyCookies(sessionResponse, NextResponse.redirect(url));
};

const loginRedirectSearch = (request: NextRequest) => {
  const candidate = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  return isSafeReturnPath(candidate)
    ? `?next=${encodeURIComponent(candidate)}`
    : "";
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
      return redirectTo(
        request,
        sessionResponse,
        "/login",
        loginRedirectSearch(request),
      );
    }

    return sessionResponse;
  }

  if (!hasSupabaseAuthCookie(request) && !isPublicPath(pathname)) {
    return redirectTo(
      request,
      sessionResponse,
      "/",
      loginRedirectSearch(request),
    );
  }

  // Cookie presence is enough to leave `/`; suite layout validates the session.
  if (pathname === "/") {
    return redirectTo(request, sessionResponse, "/home");
  }

  // Protected routes: do not block on getUser. /login still confirms the session.
  if (pathname !== "/login" || !hasSupabaseAuthCookie(request)) {
    return sessionResponse;
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

  const { user, timedOut } = await getAuthUserWithTimeout(supabase);

  if (timedOut) {
    return response;
  }

  if (user && pathname === "/login") {
    const nextPath = request.nextUrl.searchParams.get("next");
    if (nextPath && isSafeWhatsAppOAuthReturnPath(nextPath)) {
      const resumeUrl = request.nextUrl.clone();
      resumeUrl.pathname = "/api/auth/whatsapp/callback";
      resumeUrl.search = new URL(nextPath, request.nextUrl.origin).search;
      return copyCookies(response, NextResponse.redirect(resumeUrl));
    }

    if (isSafeReturnPath(nextPath)) {
      const dest = request.nextUrl.clone();
      const parsed = new URL(nextPath, request.nextUrl.origin);
      dest.pathname = parsed.pathname;
      dest.search = parsed.search;
      dest.hash = "";
      return copyCookies(response, NextResponse.redirect(dest));
    }

    return redirectTo(request, response, "/home");
  }

  return response;
};
