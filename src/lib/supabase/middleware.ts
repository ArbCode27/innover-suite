import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = [
  "/login",
  "/privacy",
  "/api/health",
  "/api/auth/instagram/callback",
  "/api/cron/instagram/refresh",
  "/api/meta/webhook",
  "/api/webhooks/meta",
];

const isPublicPath = (pathname: string) =>
  PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));

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

export const updateSession = async (request: NextRequest) => {
  let sessionResponse = NextResponse.next({ request });
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const { pathname } = request.nextUrl;

  if (!supabaseUrl || !supabaseAnonKey) {
    if (!isPublicPath(pathname)) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }

    return sessionResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        sessionResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          sessionResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: membership } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (!membership?.organization_id && !pathname.startsWith("/onboarding")) {
      return redirectWithCookies(request, sessionResponse, "/onboarding/organization");
    }

    if (membership?.organization_id && (pathname === "/login" || pathname === "/")) {
      return redirectWithCookies(request, sessionResponse, "/inbox");
    }
  }

  if (!user && !isPublicPath(pathname)) {
    return redirectWithCookies(request, sessionResponse, "/login");
  }

  return sessionResponse;
};
