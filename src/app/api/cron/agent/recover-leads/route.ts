import { NextRequest, NextResponse } from "next/server";
import { recoverIdleLeadConversations } from "@/lib/agent/lead-recovery";
import { env } from "@/lib/config/env";
import { logMetaWebhook } from "@/lib/webhooks/meta/logger";

const hasValidCronSecret = (request: NextRequest) => {
  if (!env.cronSecret) {
    return false;
  }

  const authHeader = request.headers.get("authorization");
  const tokenFromHeader = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : null;
  const tokenFromCustomHeader = request.headers.get("x-cron-secret");
  return tokenFromHeader === env.cronSecret || tokenFromCustomHeader === env.cronSecret;
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!hasValidCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await recoverIdleLeadConversations();
    logMetaWebhook("info", "agent.lead_recovery_cron_completed", result);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logMetaWebhook("error", "agent.lead_recovery_cron_failed", { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
