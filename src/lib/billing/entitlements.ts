import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getPlanById,
  intersectModules,
  modulesAllowedByVertical,
  resolveSuiteAccess,
  type BillingTier,
  type BillingVertical,
  type OrgEntitlements,
  type PlanRecord,
  type SubscriptionStatus,
} from "@/lib/billing/plans";
import { DEFAULT_MODULES, isModuleKey, type OrganizationModules } from "@/lib/modules/constants";
import { loadOrganizationModules } from "@/lib/modules/settings";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type SubscriptionRow = {
  organization_id: number;
  plan_id: string;
  status: SubscriptionStatus;
  current_period_start: string;
  current_period_end: string;
  admin_notes: string | null;
};

type UsageRow = {
  ai_responses: number;
  ai_quota_exhausted_at: string | null;
};

type PlanRow = {
  id: string;
  vertical: BillingVertical;
  tier: BillingTier;
  name: string;
  price_usd: number;
  users_limit: number;
  ai_responses_limit: number;
  channels_limit: number;
  lead_recovery: boolean;
};

type PlanModuleRow = {
  module_key: string;
  included: boolean;
};

const FALLBACK_PLAN = getPlanById("ventas_basic")!;

const toPlanRecord = (row: PlanRow | null, fallbackId: string): PlanRecord => {
  if (row) {
    return {
      id: row.id,
      vertical: row.vertical,
      tier: row.tier,
      name: row.name,
      priceUsd: Number(row.price_usd),
      usersLimit: row.users_limit,
      aiResponsesLimit: row.ai_responses_limit,
      channelsLimit: row.channels_limit,
      leadRecovery: row.lead_recovery,
    };
  }
  return getPlanById(fallbackId) ?? FALLBACK_PLAN;
};

const allowedFromPlanModules = (
  rows: PlanModuleRow[] | null,
  vertical: BillingVertical,
): OrganizationModules => {
  if (!rows?.length) {
    return modulesAllowedByVertical(vertical);
  }
  const next = { ...DEFAULT_MODULES };
  for (const key of Object.keys(next) as (keyof OrganizationModules)[]) {
    next[key] = false;
  }
  for (const row of rows) {
    if (isModuleKey(row.module_key) && row.included) {
      next[row.module_key] = true;
    }
  }
  return next;
};

const buildEntitlements = (params: {
  organizationId: number;
  subscription: SubscriptionRow | null;
  plan: PlanRecord;
  allowedModules: OrganizationModules;
  enabledModules: OrganizationModules;
  usage: UsageRow | null;
}): OrgEntitlements => {
  const periodStart = params.subscription?.current_period_start ?? new Date().toISOString();
  const periodEnd =
    params.subscription?.current_period_end ??
    new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const status = params.subscription?.status ?? "trialing";
  const used = params.usage?.ai_responses ?? 0;
  const limit = params.plan.aiResponsesLimit;
  const remaining = Math.max(0, limit - used);
  const exhausted = used >= limit || Boolean(params.usage?.ai_quota_exhausted_at);
  const suiteAccess = params.subscription
    ? resolveSuiteAccess(status, periodEnd)
    : "grace";

  return {
    organizationId: params.organizationId,
    plan: params.plan,
    subscriptionStatus: status,
    periodStart,
    periodEnd,
    allowedModules: params.allowedModules,
    effectiveModules: intersectModules(params.allowedModules, params.enabledModules),
    usersLimit: params.plan.usersLimit,
    aiResponsesLimit: limit,
    aiResponsesUsed: used,
    aiRemaining: remaining,
    aiExhausted: exhausted,
    aiUsagePercent: limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 100,
    suiteAccess,
    adminNotes: params.subscription?.admin_notes ?? null,
  };
};

export const loadOrgEntitlements = async (
  organizationId: number,
  client?: SupabaseClient,
): Promise<OrgEntitlements> => {
  let supabase = client;
  if (!supabase) {
    try {
      supabase = getSupabaseAdminClient();
    } catch {
      supabase = await createSupabaseServerClient();
    }
  }

  const [subResult, enabledModules] = await Promise.all([
    supabase
      .from("organization_subscriptions")
      .select(
        "organization_id, plan_id, status, current_period_start, current_period_end, admin_notes",
      )
      .eq("organization_id", organizationId)
      .maybeSingle<SubscriptionRow>(),
    loadOrganizationModules(supabase, organizationId),
  ]);

  const subscription = subResult.data;
  const planId = subscription?.plan_id ?? "ventas_basic";

  const [planResult, modulesResult, usageResult] = await Promise.all([
    supabase.from("plans").select("*").eq("id", planId).maybeSingle<PlanRow>(),
    supabase
      .from("plan_modules")
      .select("module_key, included")
      .eq("plan_id", planId)
      .returns<PlanModuleRow[]>(),
    subscription
      ? supabase
          .from("organization_usage_periods")
          .select("ai_responses, ai_quota_exhausted_at")
          .eq("organization_id", organizationId)
          .eq("period_start", subscription.current_period_start)
          .maybeSingle<UsageRow>()
      : Promise.resolve({ data: null, error: null }),
  ]);

  const catalogPlan = getPlanById(planId);
  const plan = toPlanRecord(planResult.data, planId);
  const allowedModules = allowedFromPlanModules(
    modulesResult.data,
    plan.vertical ?? catalogPlan?.vertical ?? "ventas",
  );

  return buildEntitlements({
    organizationId,
    subscription: subscription ?? null,
    plan,
    allowedModules,
    enabledModules,
    usage: usageResult.data ?? null,
  });
};

export const loadCachedOrgEntitlements = cache(async (organizationId: number) =>
  loadOrgEntitlements(organizationId),
);
