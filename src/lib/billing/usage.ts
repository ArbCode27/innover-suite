import { loadOrgEntitlements } from "@/lib/billing/entitlements";
import {
  TRIAL_DAYS,
  defaultPlanIdForTemplate,
  getPlanById,
  modulesAllowedByVertical,
} from "@/lib/billing/plans";
import { normalizeModules } from "@/lib/modules/constants";
import { saveOrganizationModules } from "@/lib/modules/settings";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const addDays = (from: Date, days: number) => {
  const next = new Date(from);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

export const provisionOrganizationSubscription = async (params: {
  organizationId: number;
  planId?: string;
  templateId?: string | null;
  status?: "trialing" | "active" | "past_due" | "suspended" | "canceled";
  periodDays?: number;
  syncModules?: boolean;
  adminNotes?: string | null;
  resetUsage?: boolean;
}) => {
  const admin = getSupabaseAdminClient();
  const planId =
    params.planId ?? defaultPlanIdForTemplate(params.templateId) ?? "ventas_basic";
  const plan = getPlanById(planId);
  if (!plan) {
    throw new Error(`Plan desconocido: ${planId}`);
  }

  const now = new Date();
  const periodDays = params.periodDays ?? TRIAL_DAYS;
  const periodStart = now.toISOString();
  const periodEnd = addDays(now, periodDays).toISOString();
  const status = params.status ?? "trialing";

  const { error: subError } = await admin.from("organization_subscriptions").upsert(
    {
      organization_id: params.organizationId,
      plan_id: planId,
      status,
      current_period_start: periodStart,
      current_period_end: periodEnd,
      cancel_at_period_end: false,
      admin_notes: params.adminNotes ?? null,
      updated_at: periodStart,
    },
    { onConflict: "organization_id" },
  );

  if (subError) {
    throw subError;
  }

  const resetUsage = params.resetUsage !== false;
  const { error: usageError } = await admin.from("organization_usage_periods").upsert(
    {
      organization_id: params.organizationId,
      period_start: periodStart,
      period_end: periodEnd,
      ai_responses: resetUsage ? 0 : undefined,
      ai_quota_exhausted_at: resetUsage ? null : undefined,
      updated_at: periodStart,
    },
    { onConflict: "organization_id,period_start" },
  );

  if (usageError) {
    // Fallback without undefined fields for PostgREST
    const { error: usageRetry } = await admin.from("organization_usage_periods").upsert(
      {
        organization_id: params.organizationId,
        period_start: periodStart,
        period_end: periodEnd,
        ai_responses: 0,
        ai_quota_exhausted_at: null,
        updated_at: periodStart,
      },
      { onConflict: "organization_id,period_start" },
    );
    if (usageRetry) {
      console.error("[BILLING] ensure usage period failed", usageRetry);
    }
  }

  await admin.from("organizations").update({ plan: planId }).eq("id", params.organizationId);

  if (params.syncModules !== false) {
    const allowed = modulesAllowedByVertical(plan.vertical);
    await saveOrganizationModules(admin, params.organizationId, normalizeModules(allowed));
  }

  return { planId, periodStart, periodEnd, status };
};

export type IncrementAiResult = {
  aiResponses: number;
  aiResponsesLimit: number;
  exhausted: boolean;
  periodStart: string;
  periodEnd: string;
};

export const incrementAiResponses = async (
  organizationId: number,
): Promise<IncrementAiResult | null> => {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.rpc("increment_ai_responses", {
    p_organization_id: organizationId,
  });

  if (error) {
    console.error("[BILLING] increment_ai_responses failed", error);
    return null;
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") return null;

  const record = row as Record<string, unknown>;
  return {
    aiResponses: Number(record.ai_responses ?? 0),
    aiResponsesLimit: Number(record.ai_responses_limit ?? 0),
    exhausted: Boolean(record.exhausted),
    periodStart: String(record.period_start ?? ""),
    periodEnd: String(record.period_end ?? ""),
  };
};

export const canRunAiAgent = async (organizationId: number) => {
  const entitlements = await loadOrgEntitlements(organizationId);
  if (entitlements.suiteAccess === "blocked") {
    return { ok: false as const, reason: "subscription_blocked" as const, entitlements };
  }
  if (entitlements.aiExhausted) {
    return { ok: false as const, reason: "ai_quota_exhausted" as const, entitlements };
  }
  return { ok: true as const, entitlements };
};
