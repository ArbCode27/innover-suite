import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export const proxy = async (request: NextRequest) => updateSession(request);

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/health|api/webhooks/|api/meta/webhook|api/cron/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
